import { PointCloudViewer } from './viewer.js';
import { BENCHMARKS } from './metrics.js';

const media = './assets/media/';
const scenes = './assets/scenes/';
const $ = (selector) => document.querySelector(selector);

const realClips = [
  {
    id: 'hoi', dataset: 'Hoi!', title: 'Opening a storage bench',
    note: 'Two synchronized iPhone views. The reference uses device depth. Colored tracks are MVMC predictions.',
  },
  {
    id: 'humman-knee', dataset: 'HuMMan-Recon', title: 'Squat and knee lift',
    note: 'Two Kinect views with a shared subject mask. Measured depth supplies the reference reconstruction; trails show MVMC predictions.',
  },
  {
    id: 'humman-step', dataset: 'HuMMan-Recon', title: 'Squat, rise, and step',
    note: 'A different viewpoint pair captures the transition from a squat to walking. Measured depth supplies the reference and the colored trails show predicted motion.',
  },
  {
    id: 'dsec', dataset: 'DSEC', title: 'Crossing a Zurich junction',
    note: 'Stereo RGB during a vehicle turn. The reference uses LiDAR-derived depth at available pixels. The projected tracks come from MVMC.',
  },
];

const comparisons = [
  { id: 'whale-cat', title: 'Bronze whale & concrete cat', frame: 20 },
  { id: 'ray-vase', title: 'Bronze ray & ceramic vase', frame: 20 },
  { id: 'wheel-statue', title: 'Spinning wheel & Gothic statue', frame: 8 },
];

const methods = {
  reference: 'Rendered reference',
  mvmc: 'MVMC',
  fourrc: '4RC',
  omnix: 'OmniX',
  mvtracker: 'VGGT-Ω + MVTracker',
  trackeverything: 'VGGT-Ω + TrackEverything',
};

function setPressed(container, field, value) {
  for (const button of container.querySelectorAll('button[data-' + field + ']')) {
    button.setAttribute('aria-pressed', button.dataset[field] === value);
  }
}

function sceneButton(item, preview, select) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'scene-pick';
  button.dataset.scene = item.id;
  button.setAttribute('aria-pressed', 'false');
  const image = new Image();
  image.src = preview;
  image.alt = '';
  image.loading = 'lazy';
  const label = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = item.title;
  label.append(title);
  if (item.dataset) {
    const name = document.createElement('small');
    name.textContent = item.dataset;
    label.append(name);
  }
  button.append(image, label);
  button.addEventListener('click', () => select(item));
  return button;
}

function initMovies() {
  const video = $('#real-video');
  const list = $('#video-scenes');
  let active = realClips[0].id;
  for (const item of realClips) {
    list.append(sceneButton(item, media + item.id + '-thumb.webp', (clip) => {
      if (active === clip.id) return;
      active = clip.id;
      setPressed(list, 'scene', active);
      video.pause();
      video.poster = media + active + '-poster.webp';
      video.src = media + active + '.mp4';
      video.setAttribute('aria-label', clip.title + ' on the ' + clip.dataset + ' dataset');
      $('#film-dataset').textContent = clip.dataset;
      $('#film-title').textContent = clip.title;
      $('#film-note').textContent = clip.note;
    }));
  }
  setPressed(list, 'scene', active);
}

function initComparisons() {
  const list = $('#comparison-scenes');
  const stage = $('#compare-stage');
  const reveal = $('#reveal');
  const left = $('#compare-left');
  const right = $('#compare-right');
  const kind = $('#compare-kind');
  const layout = $('#compare-layout');
  let active = comparisons[0];
  let panel = 'geometry';

  function updatePanels() {
    for (const [side, method] of [['left', left.value], ['right', right.value]]) {
      const image = $('#compare-' + side + '-img');
      image.src = media + [active.id, method, panel].join('-') + '.webp';
      image.alt = methods[method] + ' ' + (panel === 'geometry' ? 'point cloud' : 'point trajectories') + ' for ' + active.title;
    }
    stage.dataset.kind = panel;
    $('#compare-note').textContent = panel === 'geometry'
      ? 'Frame ' + active.frame + ' under the same display projection. The full figure shows alignment and per-scene errors.'
      : 'Six corresponding points over the full clip. Trajectories share their rendered starting points; faint lines show the reference motion.';
    $('#full-comparison').href = media + active.id + '-comparison.webp';
  }

  for (const [id, label] of Object.entries(methods)) {
    left.add(new Option(label, id));
    right.add(new Option(label, id));
  }
  left.value = 'mvmc';
  right.value = 'fourrc';
  for (const item of comparisons) {
    list.append(sceneButton(item, media + item.id + '-thumb.webp', (scene) => {
      active = scene;
      setPressed(list, 'scene', active.id);
      updatePanels();
    }));
  }
  setPressed(list, 'scene', active.id);
  for (const selector of [left, right]) selector.addEventListener('change', updatePanels);
  kind.addEventListener('click', (event) => {
    const value = event.target.closest('[data-kind]')?.dataset.kind;
    if (!value) return;
    panel = value;
    setPressed(kind, 'kind', panel);
    updatePanels();
  });
  layout.addEventListener('click', (event) => {
    const value = event.target.closest('[data-layout]')?.dataset.layout;
    if (!value) return;
    setPressed(layout, 'layout', value);
    stage.dataset.layout = value;
    reveal.hidden = value !== 'wipe';
  });
  reveal.addEventListener('input', () => stage.style.setProperty('--reveal', reveal.value + '%'));
  updatePanels();
}

function initBenchmarks() {
  const group = $('#benchmarks');
  const body = $('#result-table tbody');
  function show(name) {
    const benchmark = BENCHMARKS[name];
    const rows = benchmark.rows;
    const best = [0, 1, 2, 3, 4, 5].map((idx) => {
      const scores = rows.map((row) => row[idx + 1]).filter((score) => score !== null).map(Number);
      return idx === 3 ? Math.min(...scores) : Math.max(...scores);
    });
    $('#result-context').textContent = benchmark.context;
    $('#result-caption').textContent = 'Multi-camera 3D point tracking on ' + benchmark.label;
    const fragment = document.createDocumentFragment();
    for (const [method, ...scores] of rows) {
      const row = document.createElement('tr');
      row.classList.toggle('own', method === 'MVMC');
      const header = document.createElement('th');
      header.scope = 'row';
      header.textContent = method;
      row.append(header);
      scores.forEach((score, index) => {
        const cell = row.insertCell();
        cell.textContent = score ?? '—';
        cell.classList.toggle('best', score !== null && Number(score) === best[index]);
      });
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    setPressed(group, 'benchmark', name);
  }
  group.addEventListener('click', (event) => {
    const name = event.target.closest('[data-benchmark]')?.dataset.benchmark;
    if (name) show(name);
  });
  show('kubric');
}

async function fetchData(url, format) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load ' + url);
  return response[format]();
}

function initViewer() {
  const picker = $('#scene');
  const canvas = $('#scene-canvas');
  const poster = $('#viewer-poster');
  const status = $('#viewer-status');
  const bottom = $('#viewer-bottom');
  const overlays = $('#viewer-overlays');
  const seek = $('#scene-time');
  const play = $('#play-scene');
  const tracks = $('#show-trails');
  const cache = new Map();
  let renderer;
  let id;
  let source;
  let requestedSource;
  let loaded;
  let generation = 0;
  let timer;
  let frame = 4;

  function message(content) {
    status.textContent = content;
    status.hidden = !content;
  }

  function stopPlayback() {
    clearInterval(timer);
    timer = null;
    play.setAttribute('aria-pressed', 'false');
    play.setAttribute('aria-label', 'Play 3D scene');
  }

  function showFallback(asset, description) {
    stopPlayback();
    if (asset) {
      poster.src = media + asset + '-preview.webp';
      poster.alt = picker.selectedOptions[0].text + ' reconstructed from two camera views';
      $('#input-view').src = scenes + asset + '-input.jpg';
    }
    poster.hidden = false;
    canvas.hidden = true;
    overlays.hidden = true;
    bottom.hidden = true;
    message(description);
  }

  function setFrame(index) {
    if (!loaded) return;
    frame = index;
    renderer.setFrame(frame);
    seek.value = frame + 1;
    seek.setAttribute('aria-valuetext', 'Frame ' + (frame + 1) + ' of ' + loaded.length);
    $('#frame-output').textContent = String(frame + 1).padStart(2, '0') + ' / ' + loaded.length;
  }

  function record(asset) {
    if (!cache.has(asset)) {
      cache.set(asset, {
        meta: fetchData(scenes + asset + '.json', 'json'),
        predicted: fetchData(scenes + asset + '.bin', 'arrayBuffer'),
      });
    }
    return cache.get(asset);
  }

  async function selectCloud(requested, reset = false) {
    const current = ++generation;
    requestedSource = requested;
    const asset = id;
    const entry = record(asset);
    if (requested === 'reference' && !entry.reference) {
      entry.reference = fetchData(scenes + asset + '-reference.bin', 'arrayBuffer');
    }
    message(requested === 'reference' ? 'Loading the rendered reference…' : 'Loading the 3D scene…');
    try {
      const [meta, binary] = await Promise.all([entry.meta, entry[requested]]);
      if (current !== generation) return;
      const frames = requested === 'reference' ? meta.referenceFrames : meta.frames;
      const paths = requested === 'reference' ? meta.referenceTracks : meta.tracks;
      if (!frames?.length || !Array.isArray(paths) || frames.some(({ count, offset }) => count <= 0 || offset < 0 || offset + count * 16 > binary.byteLength)) {
        throw new Error('The point cloud data is incomplete');
      }
      renderer.load(meta, binary, frames, paths, reset);
      renderer.showTrajectories(tracks.checked);
      loaded = frames;
      source = requested;
      requestedSource = null;
      canvas.hidden = false;
      bottom.hidden = false;
      overlays.hidden = false;
      poster.hidden = true;
      seek.max = frames.length;
      setFrame(Math.min(frame, frames.length - 1));
      setPressed(overlays, 'cloud', source);
      message('');
    } catch {
      if (requested === 'reference') delete entry.reference;
      else cache.delete(asset);
      if (current !== generation) return;
      requestedSource = null;
      if (reset) showFallback(asset, 'The point cloud could not load. Choose a scene to try again.');
      else message('The rendered reference could not load. Select it to try again.');
    }
  }

  try {
    renderer = new PointCloudViewer(canvas);
  } catch {
    showFallback(picker.value, 'WebGL is unavailable. A rendered preview is shown.');
    picker.addEventListener('change', () => showFallback(picker.value, 'WebGL is unavailable. A rendered preview is shown.'));
    return;
  }

  function chooseScene() {
    id = picker.value;
    loaded = null;
    frame = id === 'whale-cat' ? 4 : 11;
    source = 'predicted';
    showFallback(id, 'Loading the 3D scene…');
    selectCloud(source, true);
  }

  picker.addEventListener('change', chooseScene);
  chooseScene();
  seek.addEventListener('input', () => {
    stopPlayback();
    setFrame(Number(seek.value) - 1);
  });
  tracks.addEventListener('change', () => renderer.showTrajectories(tracks.checked));
  play.addEventListener('click', () => {
    if (!loaded || timer) {
      stopPlayback();
      return;
    }
    play.setAttribute('aria-pressed', 'true');
    play.setAttribute('aria-label', 'Pause 3D scene');
    timer = setInterval(() => setFrame((frame + 1) % loaded.length), 125);
  });
  overlays.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cloud]');
    if (button && button.dataset.cloud !== (requestedSource ?? source)) selectCloud(button.dataset.cloud);
  });
  $('#zoom-in').addEventListener('click', () => renderer.zoom(.83));
  $('#zoom-out').addEventListener('click', () => renderer.zoom(1.2));
  $('#reset-camera').addEventListener('click', () => renderer.reset());
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) stopPlayback();
  }).observe(canvas.parentElement);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPlayback();
  });
  canvas.addEventListener('webglcontextlost', () => {
    generation += 1;
    showFallback(id, 'The graphics context was lost. Reload to restart the 3D viewer.');
  });
}

initMovies();
initComparisons();
initBenchmarks();
initViewer();
