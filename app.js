import { PointCloudViewer } from './viewer.js?v=fan-focus';
import { BENCHMARKS } from './metrics.js';
import { GALLERY } from './gallery-data.js';

const media = './assets/media/';
const scenes = './assets/scenes/';
const gallery = './assets/gallery/';
const $ = (selector) => document.querySelector(selector);

const couchScene = {
  id: 'scenehub-couch',
  title: 'Turning on a couch',
  frame: 15,
  dataset: 'SceneHub4D',
  credit: 'https://scenehub4d.github.io/',
  revision: '?v=couch-refined',
};

const studioScenes = [
  { id: 'n3dv-flame-salmon', title: 'Flambéing salmon', frame: 19, dataset: 'N3DV', credit: 'https://github.com/facebookresearch/Neural_3D_Video', revision: '?v=static-bg' },
  { id: 'sjtu-fan-dance', title: 'Fan dance with a step off a stool', frame: 1, dataset: 'SJTU Free Viewpoint', credit: 'https://medialab.sjtu.edu.cn/post/free-viewpoint-rgb-d-video-dataset/', revision: '?v=fan-focus' },
  { id: 'sjtu-football', title: 'Two-player football pass', frame: 13, dataset: 'SJTU Free Viewpoint', credit: 'https://medialab.sjtu.edu.cn/post/free-viewpoint-rgb-d-video-dataset/' },
  { id: 'hdr-tumbler', title: 'Rotating a tumbler by hand', frame: 13, dataset: 'HDR-GoPro', credit: 'https://huggingface.co/datasets/SHlNDY/HDR-NSFF' },
  { id: 'ucsd-courtyard', title: 'Walking across a courtyard', frame: 13, dataset: 'UCSD Dynamic', credit: 'https://cseweb.ucsd.edu/~viscomp/projects/ICCV21Deep/' },
  { id: 'thun-street', title: 'Walking along a Thun street', frame: 7, dataset: 'DSEC', reference: 'LiDAR-derived depth', frames: 12, interval: 200, credit: 'https://dsec.ifi.uzh.ch/' },
  { id: 'fox-robot', title: 'Running fox & jumping robot', frame: 15, dataset: 'Synthetic', reference: 'Rendered reference', credit: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox', revision: '?v=all-backgrounds' },
  { id: 'train-tram', title: 'Steam train passing a tram', frame: 12, dataset: 'Synthetic', reference: 'Rendered reference', credit: 'https://kenney.nl/assets/train-kit', revision: '?v=all-backgrounds' },
  { id: 'zurich-night', title: 'Oncoming traffic at night', frame: 8, dataset: 'DSEC', reference: 'LiDAR-derived depth', frames: 12, interval: 200, credit: 'https://dsec.ifi.uzh.ch/', revision: '?v=static-bg' },
  { id: 'humman-knee', title: 'Squat and knee lift', frame: 13, dataset: 'HuMMan-Recon', reference: 'Kinect depth', credit: 'https://huggingface.co/datasets/caizhongang/HuMMan/tree/main/humman_release_v1.0_recon', revision: '?v=all-backgrounds' },
  couchScene,
];

const galleryClips = [
  {
    id: couchScene.id,
    title: couchScene.title,
    dataset: couchScene.dataset,
    revision: couchScene.revision,
    category: 'articulated',
    real: true,
    movie: gallery + couchScene.id + '.mp4' + couchScene.revision,
    note: 'Selected MVMC trajectories show the turn from two synchronized RGB views. The static room background is fused from several frames.',
  },
  ...GALLERY,
];

const comparisons = [
  { id: 'whale-cat', title: 'Bronze whale & concrete cat', frame: 20 },
  { id: 'ray-vase', title: 'Bronze ray & ceramic vase', frame: 20 },
  { id: 'wheel-statue', title: 'Spinning wheel & Gothic statue', frame: 8 },
  { id: 'croissant-cupcake', title: 'Croissant & iced cupcake', frame: 20, combined: true },
  { id: 'produce', title: 'Pomegranate & pumpkin', frame: 20, combined: true },
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
  image.src = preview + (item.revision ?? '');
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
  const filters = $('#gallery-filters');
  const dialog = $('#clip-dialog');
  const previous = $('#previous-clip');
  const next = $('#next-clip');
  let playlist = [];
  let index = 0;

  function playClip(at) {
    if (at < 0 || at >= playlist.length) return;
    index = at;
    const clip = playlist[index];
    video.pause();
    video.poster = gallery + clip.id + '-poster.webp' + (clip.revision ?? '');
    video.src = clip.movie;
    video.setAttribute('aria-label', clip.title);
    $('#film-dataset').textContent = clip.dataset;
    $('#film-title').textContent = clip.title;
    $('#film-note').textContent = clip.note;
    $('#film-position').textContent = (index + 1) + ' / ' + playlist.length;
    previous.disabled = index === 0;
    next.disabled = index === playlist.length - 1;
    if (!dialog.open) dialog.showModal();
    video.play().catch(() => {});
  }

  function showCategory(filter) {
    playlist = galleryClips.filter((clip) => filter === 'all' || (filter === 'real' ? clip.real : clip.category === filter));
    const content = document.createDocumentFragment();
    playlist.forEach((clip, at) => {
      const card = sceneButton(clip, gallery + clip.id + '-thumb.webp', () => playClip(at));
      card.removeAttribute('aria-pressed');
      card.setAttribute('aria-haspopup', 'dialog');
      const thumbnail = card.querySelector('img');
      const preview = document.createElement('div');
      preview.className = 'gallery-thumbnail';
      card.prepend(preview);
      preview.append(thumbnail);
      content.append(card);
    });
    list.replaceChildren(content);
    $('#gallery-count').textContent = playlist.length + ' scenes';
    setPressed(filters, 'filter', filter);
  }

  filters.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-filter]')?.dataset.filter;
    if (filter) showCategory(filter);
  });
  previous.addEventListener('click', () => playClip(index - 1));
  next.addEventListener('click', () => playClip(index + 1));
  $('#close-clip').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  showCategory('all');
}

function initShowreel() {
  const reel = $('#showreel-video');
  const control = $('#reel-control');
  reel.controls = false;
  control.hidden = false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reel.autoplay = false;
    reel.pause();
  }
  const reflectPlayback = () => {
    control.textContent = reel.paused ? 'Play preview' : 'Pause preview';
  };
  reel.addEventListener('play', reflectPlayback);
  reel.addEventListener('pause', reflectPlayback);
  control.addEventListener('click', () => {
    if (reel.paused) reel.play().catch(reflectPlayback);
    else reel.pause();
  });
  reflectPlayback();
  let resume = false;
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) {
      resume = !reel.paused;
      reel.pause();
    } else if (resume) {
      reel.play().catch(() => {});
    }
  }, { threshold: 0.15 }).observe(reel);
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
    kind.hidden = Boolean(active.combined);
    const view = active.combined ? 'geometry' : panel;
    stage.dataset.display = active.combined ? 'overlaid' : 'split';
    for (const [side, method] of [['left', left.value], ['right', right.value]]) {
      const image = $('#compare-' + side + '-img');
      image.src = media + [active.id, method, view].join('-') + '.webp';
      image.alt = methods[method] + ' ' + (view === 'geometry' ? 'point cloud' : 'point trajectories') + ' for ' + active.title;
    }
    stage.dataset.kind = view;
    let note;
    if (active.combined) note = 'Frame ' + active.frame + ' with tracked points overlaid on the reconstruction. The full figure reports the per-scene errors.';
    else if (view === 'geometry') note = 'Frame ' + active.frame + ' under the same display projection. The full figure shows alignment and per-scene errors.';
    else note = 'Six corresponding points over the full clip. Trajectories share their rendered starting points; faint lines show the reference motion.';
    $('#compare-note').textContent = note;
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
  const picker = $('#studio-scenes');
  const canvas = $('#scene-canvas');
  const poster = $('#viewer-poster');
  const status = $('#viewer-status');
  const bottom = $('#viewer-bottom');
  const overlays = $('#viewer-overlays');
  const sourceControls = overlays.querySelector('.viewer-source');
  const reference = overlays.querySelector('[data-cloud="reference"]');
  const seek = $('#scene-time');
  const play = $('#play-scene');
  const tracks = $('#show-trails');
  const background = $('#show-background');
  const backgroundControl = background.closest('label');
  const cache = new Map();
  let renderer;
  let id;
  let source;
  let requestedSource;
  let activeScene;
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
      const scene = studioScenes.find((item) => item.id === asset);
      poster.src = scenes + asset + '-preview.webp' + (scene.revision ?? '');
      poster.alt = 'MVMC preview of ' + scene.title;
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

  function record({ id: asset, revision = '' }) {
    if (!cache.has(asset)) {
      cache.set(asset, {
        meta: fetchData(scenes + asset + '.json' + revision, 'json'),
        predicted: fetchData(scenes + asset + '.bin' + revision, 'arrayBuffer'),
      });
    }
    return cache.get(asset);
  }

  async function attachBackground(entry, asset, revision, requested, spec, current) {
    if (!spec?.count) return;
    const key = requested === 'reference' ? 'reference-background' : 'background';
    entry[key] ??= fetchData(scenes + asset + '-' + key + '.bin' + revision, 'arrayBuffer');
    try {
      const bytes = await entry[key];
      if (bytes.byteLength !== spec.count * 16) throw new Error('The static point cloud is incomplete');
      if (current !== generation) return;
      renderer.loadBackground(bytes, spec.count);
      renderer.showBackground(background.checked);
      backgroundControl.hidden = false;
    } catch {
      delete entry[key];
    }
  }

  async function selectCloud(requested, reset = false) {
    const current = ++generation;
    requestedSource = requested;
    const asset = id;
    const revision = activeScene.revision ?? '';
    const entry = record(activeScene);
    if (requested === 'reference' && !entry.reference) {
      entry.reference = fetchData(scenes + asset + '-reference.bin' + revision, 'arrayBuffer');
    }
    message(requested === 'reference' ? 'Loading ' + activeScene.reference.toLowerCase() + '…' : 'Loading the 3D scene…');
    try {
      const [meta, binary] = await Promise.all([entry.meta, entry[requested]]);
      if (current !== generation) return;
      const frames = requested === 'reference' ? meta.referenceFrames : meta.frames;
      const paths = requested === 'reference' ? meta.referenceTracks : meta.tracks;
      if (!frames?.length || !Array.isArray(paths) || frames.some(({ count, offset }) => count <= 0 || offset < 0 || offset + count * 16 > binary.byteLength)) {
        throw new Error('The point cloud data is incomplete');
      }
      backgroundControl.hidden = true;
      renderer.load(meta, binary, frames, paths, reset);
      tracks.disabled = paths.length === 0;
      renderer.showTrajectories(tracks.checked && !tracks.disabled);
      loaded = frames;
      source = requested;
      requestedSource = null;
      canvas.hidden = false;
      bottom.hidden = false;
      overlays.hidden = false;
      poster.hidden = true;
      seek.max = frames.length;
      $('#viewer-scene-context').textContent = frames.length + ' frames';
      $('#viewer-annotation').textContent = meta.notes;
      sourceControls.hidden = !activeScene.reference;
      setFrame(Math.min(frame, frames.length - 1));
      setPressed(overlays, 'cloud', source);
      message('');
      attachBackground(entry, asset, revision, requested, meta.background?.[requested], current);
    } catch {
      if (requested === 'reference') delete entry.reference;
      else cache.delete(asset);
      if (current !== generation) return;
      requestedSource = null;
      if (reset) showFallback(asset, 'The point cloud could not load. Choose a scene to try again.');
      else message('The reference could not load. Select it to try again.');
    }
  }

  try {
    renderer = new PointCloudViewer(canvas);
  } catch {
    renderer = null;
  }

  function chooseScene(scene) {
    if (id === scene.id && loaded) return;
    activeScene = scene;
    id = scene.id;
    loaded = null;
    frame = scene.frame - 1;
    source = 'predicted';
    $('#viewer-scene-name').textContent = scene.title;
    $('#viewer-scene-context').textContent = (scene.frames ?? 24) + ' frames';
    $('#viewer-annotation').textContent = 'The viewer displays subsampled MVMC geometry and predicted trajectories.';
    $('#viewer-source-link').href = scene.credit;
    $('#viewer-source-link').textContent = scene.dataset === 'Synthetic' ? 'Scene assets' : scene.dataset + ' dataset';
    reference.textContent = scene.reference ?? '';
    reference.hidden = !scene.reference;
    setPressed(picker, 'scene', id);
    showFallback(id, renderer ? 'Loading the 3D scene…' : 'WebGL is unavailable. A rendered preview is shown.');
    if (renderer) selectCloud(source, true);
  }

  for (const scene of studioScenes) {
    picker.append(sceneButton(scene, scenes + scene.id + '-preview.webp', chooseScene));
  }
  chooseScene(studioScenes[0]);
  if (!renderer) return;
  seek.addEventListener('input', () => {
    stopPlayback();
    setFrame(Number(seek.value) - 1);
  });
  tracks.addEventListener('change', () => renderer.showTrajectories(tracks.checked));
  background.addEventListener('change', () => renderer.showBackground(background.checked));
  play.addEventListener('click', () => {
    if (!loaded || timer) {
      stopPlayback();
      return;
    }
    play.setAttribute('aria-pressed', 'true');
    play.setAttribute('aria-label', 'Pause 3D scene');
    timer = setInterval(() => setFrame((frame + 1) % loaded.length), activeScene.interval ?? 125);
  });
  overlays.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cloud]');
    if (button && button.dataset.cloud !== (requestedSource ?? source)) selectCloud(button.dataset.cloud);
  });
  $('#zoom-in').addEventListener('click', () => renderer.zoom(.83));
  $('#zoom-out').addEventListener('click', () => renderer.zoom(1.2));
  $('#reset-camera').addEventListener('click', () => renderer.reset());
  const expand = $('#expand-viewer');
  const container = canvas.closest('.viewer');
  if (document.fullscreenEnabled && container.requestFullscreen) {
    expand.hidden = false;
    expand.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === container) await document.exitFullscreen();
        else await container.requestFullscreen();
      } catch {
        message('Full screen is unavailable in this browser.');
      }
    });
    document.addEventListener('fullscreenchange', () => {
      expand.textContent = document.fullscreenElement === container ? 'Exit full screen' : 'Full screen';
    });
  }
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
initShowreel();
initComparisons();
initBenchmarks();
initViewer();
