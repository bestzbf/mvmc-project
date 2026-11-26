const VERTEX_SOURCE = 'attribute vec3 aPosition;' +
  'attribute vec3 aColor;' +
  'uniform mat4 uCamera;' +
  'uniform float uSize;' +
  'varying vec3 vColor;' +
  'void main() {' +
  '  gl_Position = uCamera * vec4(aPosition, 1.0);' +
  '  gl_PointSize = uSize;' +
  '  vColor = aColor;' +
  '}';

const FRAGMENT_SOURCE = 'precision mediump float;' +
  'varying vec3 vColor;' +
  'uniform bool uSplat;' +
  'uniform bool uCloud;' +
  'void main() {' +
  '  if (uSplat && length(gl_PointCoord - vec2(0.5)) > 0.48) discard;' +
  '  vec3 color = uCloud ? pow(vColor, vec3(0.78)) : vColor;' +
  '  gl_FragColor = vec4(color, 1.0);' +
  '}';

const PALETTE = [
  [.98, .60, .35], [.70, .58, 1.0], [.31, .87, 1.0],
  [.37, .95, .70], [1.0, .52, .62], [.97, .85, .44],
  [.45, .64, 1.0], [1.0, .46, .78], [.63, .98, .54],
  [1.0, .70, .45], [.63, .84, .99], [.95, .9, .67],
];

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function unit(a) {
  const length = Math.hypot(...a);
  return a.map((value) => value / length);
}

function cameraMatrix(eye, center, aspect, near, far) {
  const z = unit(eye.map((value, axis) => value - center[axis]));
  const x = unit(cross([0, 1, 0], z));
  const y = cross(z, x);
  const view = [
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ];
  const f = 1 / Math.tan(41 * Math.PI / 360);
  const a = (far + near) / (near - far);
  const b = (2 * far * near) / (near - far);
  const result = new Float32Array(16);
  for (let k = 0; k < 16; k += 4) {
    result[k] = view[k] * f / aspect;
    result[k + 1] = view[k + 1] * f;
    result[k + 2] = a * view[k + 2] + b * view[k + 3];
    result[k + 3] = -view[k + 2];
  }
  return result;
}

function programFor(gl) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SOURCE], [gl.FRAGMENT_SHADER, FRAGMENT_SOURCE]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Unable to compile the viewer shader');
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Unable to start the viewer shader');
  }
  return program;
}

function addVertex(vertices, point, color) {
  vertices.push(...point, ...color);
}

export class PointCloudViewer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) throw new Error('WebGL is unavailable');
    this.canvas = canvas;
    this.gl = gl;
    const program = programFor(gl);
    gl.useProgram(program);
    this.position = gl.getAttribLocation(program, 'aPosition');
    this.color = gl.getAttribLocation(program, 'aColor');
    this.camera = gl.getUniformLocation(program, 'uCamera');
    this.size = gl.getUniformLocation(program, 'uSize');
    this.splat = gl.getUniformLocation(program, 'uSplat');
    this.shade = gl.getUniformLocation(program, 'uCloud');
    gl.enableVertexAttribArray(this.position);
    gl.enableVertexAttribArray(this.color);
    gl.clearColor(0, 0, 0, 0);
    this.cloudBuffer = gl.createBuffer();
    this.gridBuffer = gl.createBuffer();
    this.trailBuffer = gl.createBuffer();
    this.frame = 0;
    this.drawTrajectories = true;
    this.drawRequest = 0;
    this.attachCameraControls();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
  }

  load(metadata, bytes, frames, tracks, reset) {
    this.meta = metadata;
    this.frames = frames;
    this.bytes = bytes;
    this.tracks = tracks;
    if (reset) {
      this.reset();
      this.prepareFloor();
    }
    this.setFrame(Math.min(this.frame, frames.length - 1));
  }

  reset() {
    if (!this.meta) return;
    this.azimuth = this.meta.orbit.azimuth;
    this.elevation = this.meta.orbit.elevation;
    this.zoomFactor = this.meta.orbit.zoom ?? 1;
    this.draw();
  }

  zoom(factor) {
    if (!this.meta) return;
    this.zoomFactor = clamp(this.zoomFactor * factor, .43, 2.4);
    this.draw();
  }

  turn(x, y) {
    if (!this.meta) return;
    this.azimuth += x;
    this.elevation = clamp(this.elevation + y, -1.43, 1.43);
    this.draw();
  }

  setFrame(index) {
    if (!this.frames) return;
    this.frame = index;
    const frame = this.frames[index];
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.cloudBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Uint8Array(this.bytes, frame.offset, frame.count * 16), this.gl.DYNAMIC_DRAW);
    this.draw();
  }

  showTrajectories(show) {
    this.drawTrajectories = show;
    this.draw();
  }

  attachCameraControls() {
    const { canvas } = this;
    let pointer;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || pointer) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (pointer?.id !== event.pointerId) return;
      this.turn((pointer.x - event.clientX) * .008, (event.clientY - pointer.y) * .008);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(event, (e) => {
        if (pointer?.id === e.pointerId) pointer = null;
      });
    }
    canvas.addEventListener('wheel', (event) => {
      if (!this.meta) return;
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      this.zoom(Math.exp(clamp(delta * .002, -.5, .5)));
    }, { passive: false });
    canvas.addEventListener('keydown', (event) => {
      const angles = { ArrowLeft: [.13, 0], ArrowRight: [-.13, 0], ArrowUp: [0, .13], ArrowDown: [0, -.13] };
      if (angles[event.key]) this.turn(...angles[event.key]);
      else if (event.key === '+' || event.key === '=') this.zoom(.83);
      else if (event.key === '-') this.zoom(1.2);
      else if (event.key === 'Home') this.reset();
      else return;
      event.preventDefault();
    });
  }

  prepareFloor() {
    const { gl, meta } = this;
    if (meta.floor === false) {
      this.gridCount = 0;
      return;
    }
    const [x, y, z] = meta.center;
    const r = meta.viewRadius;
    const floor = y - .67 * r;
    const edge = 1.65 * r;
    const color = [.145, .19, .285];
    const vertices = [];
    for (let i = -6; i <= 6; i += 1) {
      const step = i * edge / 6;
      addVertex(vertices, [x - edge, floor, z + step], color);
      addVertex(vertices, [x + edge, floor, z + step], color);
      addVertex(vertices, [x + step, floor, z - edge], color);
      addVertex(vertices, [x + step, floor, z + edge], color);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    this.gridCount = vertices.length / 6;
  }

  draw() {
    if (!this.drawRequest) {
      this.drawRequest = requestAnimationFrame(() => {
        this.drawRequest = 0;
        this.render();
      });
    }
  }

  bind(buffer, byteColor = false) {
    const gl = this.gl;
    const stride = byteColor ? 16 : 24;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(this.color, 3, byteColor ? gl.UNSIGNED_BYTE : gl.FLOAT, byteColor, stride, 12);
  }

  render() {
    const { gl, canvas, meta } = this;
    if (!meta || canvas.hidden || gl.isContextLost()) return;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (cssWidth < 1 || cssHeight < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = width / height;
    const r = meta.viewRadius;
    const radius = 2.9 * r * Math.max(1, 1.18 / aspect) * this.zoomFactor;
    const c = Math.cos(this.elevation);
    const s = [
      Math.sin(this.azimuth) * c,
      Math.sin(this.elevation),
      Math.cos(this.azimuth) * c,
    ];
    const eye = meta.center.map((v, i) => v + radius * s[i]);
    gl.uniformMatrix4fv(this.camera, false, cameraMatrix(eye, meta.center, aspect, .02 * r, radius + meta.radius * 3));

    gl.disable(gl.DEPTH_TEST);
    gl.uniform1i(this.splat, 0);
    gl.uniform1i(this.shade, 0);
    if (this.gridCount) {
      this.bind(this.gridBuffer);
      gl.drawArrays(gl.LINES, 0, this.gridCount);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.uniform1i(this.splat, 1);
    gl.uniform1i(this.shade, 1);
    const pointSize = (cssHeight / 103) / this.zoomFactor * (meta.pointSize ?? 1);
    gl.uniform1f(this.size, clamp(pointSize, 1.3, 7.5) * dpr);
    this.bind(this.cloudBuffer, true);
    gl.drawArrays(gl.POINTS, 0, this.frames[this.frame].count);

    if (this.drawTrajectories) this.renderTrajectories(dpr);
  }

  renderTrajectories(dpr) {
    const gl = this.gl;
    const vertices = [];
    const ends = [];
    const since = Math.max(1, this.frame - (this.meta.trailLength ?? this.frame) + 1);
    for (let i = 0; i < this.tracks.length; i += 1) {
      const track = this.tracks[i];
      const color = PALETTE[i % PALETTE.length];
      if (track[this.frame]) addVertex(ends, track[this.frame], color);
      for (let j = since; j <= this.frame; j += 1) {
        if (!track[j - 1] || !track[j]) continue;
        addVertex(vertices, track[j - 1], color);
        addVertex(vertices, track[j], color);
      }
    }
    const count = vertices.length / 6;
    this.bind(this.trailBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...vertices, ...ends]), gl.DYNAMIC_DRAW);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform1i(this.shade, 0);
    gl.uniform1i(this.splat, 0);
    gl.drawArrays(gl.LINES, 0, count);
    gl.uniform1i(this.splat, 1);
    gl.uniform1f(this.size, 6.5 * dpr);
    gl.drawArrays(gl.POINTS, count, ends.length / 6);
  }
}
