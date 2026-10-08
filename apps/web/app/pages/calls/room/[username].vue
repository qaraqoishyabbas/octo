<script setup lang="ts">
import { createLocalId } from '~/utils/create-local-id';
import { copyToClipboard } from '~/utils/copy-to-clipboard';

definePageMeta({ layout: 'empty', middleware: ['auth'] });

useSeoMeta({ title: 'Встреча' });

type CallSettings = {
  cameraEnabled?: boolean;
  microphoneEnabled?: boolean;
  cameraId?: string;
  microphoneId?: string;
  title?: string;
};

type DeviceOption = {
  label: string;
  value: string;
};

type ParticipantConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

type CallParticipant = {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  screenSharing: boolean;
  stream: MediaStream | null;
  joinedAt: number;
  connectionStatus: ParticipantConnectionStatus;
  audioLevel: number;
  isSpeaking: boolean;
  isLocal?: boolean;
};

type CallParticipantPayload = Pick<
  CallParticipant,
  | 'id'
  | 'userId'
  | 'name'
  | 'avatar'
  | 'cameraEnabled'
  | 'microphoneEnabled'
  | 'screenSharing'
  | 'joinedAt'
>;

type CallSignalPayload = {
  senderId?: string;
  targetId?: string;
  participant?: CallParticipantPayload;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type RemoteAudioMeter = {
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  frame: number | null;
};

const CALL_SETTINGS_KEY = 'octo:calls:settings';
const CALL_HEARTBEAT_INTERVAL_MS = 5000;
const CALL_STALE_TIMEOUT_MS = 15000;
const CALL_GRID_PARTICIPANTS_PER_PAGE = 6;
const CALL_THUMBNAILS_PER_PAGE = 4;

const route = useRoute();
const auth = useAuthStore();
const websocket = useWebSocketStore();
const toast = useToast();

const roomUsername = computed(() =>
  String(route.params.username || '')
    .replace(/^@/, '')
    .trim(),
);
const callChannel = computed(() => `call.${roomUsername.value}`);
const privateCallChannel = computed(() => `private-${callChannel.value}`);
const clientId = createClientId();
const videoRef = ref<HTMLVideoElement | null>(null);
const stream = ref<MediaStream | null>(null);
const screenStream = ref<MediaStream | null>(null);
const cameraEnabled = ref(true);
const microphoneEnabled = ref(true);
const selectedCameraId = ref('');
const selectedMicrophoneId = ref('');
const cameraOptions = ref<DeviceOption[]>([]);
const microphoneOptions = ref<DeviceOption[]>([]);
const screenSharing = ref(false);
const isJoined = ref(false);
const title = ref('');
const errorMessage = ref('');
const audioLevel = ref(0);
const mediaState = ref<'idle' | 'checking' | 'ready' | 'error'>('idle');
const mediaAction = ref<'camera' | 'microphone' | 'devices'>('devices');
const remoteParticipants = ref<CallParticipant[]>([]);
const participantsPanelOpen = ref(false);
const leaveConfirmOpen = ref(false);
const participantsCarouselPage = ref(0);
const mainParticipantId = ref('');
const localJoinedAt = Date.now();

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let analyserSource: MediaStreamAudioSourceNode | null = null;
let meterFrame: number | null = null;
let mediaRequestId = 0;
let audioRequestId = 0;
let cameraRequestId = 0;
let screenRequestId = 0;
let stopWebsocketStatusWatch: (() => void) | null = null;
let isPageCleanupDone = false;
let isCameraWatcherPaused = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let staleParticipantsTimer: ReturnType<typeof setInterval> | null = null;

const peerConnections = new Map<string, RTCPeerConnection>();
const peerReconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const signalingRetryTimers = new Set<ReturnType<typeof setTimeout>>();
const remoteVideoRefs = new Map<string, HTMLVideoElement>();
const remoteVideoRefSetters = new Map<string, (element: unknown) => void>();
const remoteParticipantSeenAt = new Map<string, number>();
const remoteAudioMeters = new Map<string, RemoteAudioMeter>();
const unsubscribeSignalHandlers: Array<() => void> = [];

const hasVideo = computed(() => Boolean(stream.value?.getVideoTracks().length));
const hasLocalVideo = computed(
  () => screenSharing.value || (cameraEnabled.value && hasVideo.value),
);
const userFullName = computed(() => {
  const firstLastName = [auth.user?.first_name, auth.user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return firstLastName || auth.user?.name || auth.user?.username || 'Пользователя';
});
const roomTitle = computed(() => title.value || `Канал ${userFullName.value}`);
const userAvatar = computed(() => auth.user?.avatar || '');
const inviteLink = computed(() => {
  if (!import.meta.client) {
    return '';
  }

  return `${window.location.origin}/calls/room/${roomUsername.value}`;
});
const localIsSpeaking = computed(() => microphoneEnabled.value && audioLevel.value > 14);
const localConnectionStatus = computed<ParticipantConnectionStatus>(() =>
  websocket.status === 'connected' ? 'connected' : 'connecting',
);
const localParticipant = computed<CallParticipant>(() => ({
  id: clientId,
  userId: String(auth.user?.id ?? clientId),
  name: userFullName.value,
  avatar: userAvatar.value,
  cameraEnabled: cameraEnabled.value,
  microphoneEnabled: microphoneEnabled.value,
  screenSharing: screenSharing.value,
  stream: stream.value,
  joinedAt: localJoinedAt,
  connectionStatus: localConnectionStatus.value,
  audioLevel: audioLevel.value,
  isSpeaking: localIsSpeaking.value,
  isLocal: true,
}));
const participantsCount = computed(() => remoteParticipants.value.length + 1);
const callParticipants = computed<CallParticipant[]>(() => [
  localParticipant.value,
  ...remoteParticipants.value,
]);
const mainParticipant = computed<CallParticipant | null>(
  () =>
    callParticipants.value.find((participant) => participant.id === mainParticipantId.value) ||
    null,
);
const secondaryParticipants = computed(() =>
  mainParticipant.value
    ? callParticipants.value.filter((participant) => participant.id !== mainParticipant.value?.id)
    : callParticipants.value,
);
const participantPages = computed(() => {
  const pages: CallParticipant[][] = [];
  const pageSize = mainParticipant.value
    ? CALL_THUMBNAILS_PER_PAGE
    : CALL_GRID_PARTICIPANTS_PER_PAGE;

  for (let index = 0; index < secondaryParticipants.value.length; index += pageSize) {
    pages.push(secondaryParticipants.value.slice(index, index + pageSize));
  }

  return pages;
});
const currentParticipantPage = computed(
  () => participantPages.value[participantsCarouselPage.value] ?? [],
);
const hasParticipantPages = computed(() => participantPages.value.length > 1);
const isSingleParticipantGrid = computed(
  () => !mainParticipant.value && currentParticipantPage.value.length === 1,
);
const thumbnailGridClass = computed(() => {
  if (mainParticipant.value) {
    if (currentParticipantPage.value.length <= 1) {
      return 'grid-cols-1';
    }

    if (currentParticipantPage.value.length === 2) {
      return 'grid-cols-2';
    }

    if (currentParticipantPage.value.length === 3) {
      return 'grid-cols-3';
    }

    return 'grid-cols-4';
  }

  if (currentParticipantPage.value.length <= 1) {
    return 'grid-cols-1';
  }

  if (currentParticipantPage.value.length <= 4) {
    return 'grid-cols-2';
  }

  return 'grid-cols-2 md:grid-cols-3';
});
const checkingLabel = computed(() => {
  if (mediaAction.value === 'camera') {
    return 'Включаем камеру...';
  }

  if (mediaAction.value === 'microphone') {
    return 'Настраиваем микрофон...';
  }

  return 'Проверяем устройства...';
});
const canConnect = computed(() => mediaState.value === 'ready' || Boolean(stream.value));

watch(participantPages, (pages) => {
  if (participantsCarouselPage.value > pages.length - 1) {
    participantsCarouselPage.value = Math.max(0, pages.length - 1);
  }
});

watch(participantsCarouselPage, () => {
  void attachLocalVideo();
});

watch(
  () => mainParticipant.value?.id,
  () => {
    void attachLocalVideo();
  },
);

watch(
  () => mainParticipant.value?.stream,
  (participantStream) => {
    const participant = mainParticipant.value;

    if (participant && !participant.isLocal && participantStream) {
      void attachRemoteVideo(participant.id, participantStream);
    }
  },
);

watch([stream, screenStream], () => {
  void attachLocalVideo();
});

watch(callParticipants, (participants) => {
  if (
    mainParticipantId.value &&
    !participants.some((participant) => participant.id === mainParticipantId.value)
  ) {
    mainParticipantId.value = '';
    participantsCarouselPage.value = 0;
  }
});

watch(cameraEnabled, async () => {
  saveCallSettings();
  if (isCameraWatcherPaused) {
    return;
  }

  await restartCallCamera();
  if (isJoined.value) {
    syncPeerTracks();
    announceMediaState();
  }
});

watch(microphoneEnabled, async () => {
  saveCallSettings();
  await restartCallMicrophone();
  if (isJoined.value) {
    syncPeerTracks();
    announceMediaState();
  }
});

watch(
  [selectedCameraId, selectedMicrophoneId],
  async ([cameraId, microphoneId], [oldCameraId, oldMicrophoneId]) => {
    saveCallSettings();

    if (
      mediaState.value !== 'ready' ||
      (cameraId === oldCameraId && microphoneId === oldMicrophoneId)
    ) {
      return;
    }

    if (cameraId !== oldCameraId) {
      await restartCallCamera();
      if (isJoined.value) {
        syncPeerTracks();
        announceMediaState();
      }
      return;
    }

    await restartCallMicrophone();
    if (isJoined.value) {
      syncPeerTracks();
      announceMediaState();
    }
  },
);

onMounted(async () => {
  loadSettings();
  navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
  window.addEventListener('pagehide', handlePageExit);
  window.addEventListener('beforeunload', handlePageExit);
  await startCallMedia('devices');
});

onBeforeUnmount(() => {
  cleanupCallPage();
  navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
  window.removeEventListener('pagehide', handlePageExit);
  window.removeEventListener('beforeunload', handlePageExit);
});

function handlePageExit() {
  cleanupCallPage();
}

function cleanupCallPage() {
  if (isPageCleanupDone) {
    return;
  }

  isPageCleanupDone = true;
  saveCallSettings();
  leaveCallChannel();
  mediaRequestId += 1;
  audioRequestId += 1;
  stopCallMedia();
}

function loadSettings() {
  const savedSettings = readCallSettings(CALL_SETTINGS_KEY);
  const roomSettings = readCallSettings(`octo:calls:${roomUsername.value}`);
  const settings = {
    ...savedSettings,
    ...roomSettings,
  };

  if (!savedSettings && !roomSettings) {
    return;
  }

  cameraEnabled.value = settings.cameraEnabled ?? true;
  microphoneEnabled.value = settings.microphoneEnabled ?? true;
  selectedCameraId.value = settings.cameraId || '';
  selectedMicrophoneId.value = settings.microphoneId || '';
  title.value = settings.title || title.value;
}

function readCallSettings(key: string) {
  const rawSettings =
    key === CALL_SETTINGS_KEY ? localStorage.getItem(key) : sessionStorage.getItem(key);

  if (!rawSettings) {
    return null;
  }

  try {
    return JSON.parse(rawSettings) as CallSettings;
  } catch {
    if (key === CALL_SETTINGS_KEY) {
      localStorage.removeItem(key);
    } else {
      sessionStorage.removeItem(key);
    }

    return null;
  }
}

function saveCallSettings() {
  const settings: CallSettings = {
    cameraEnabled: cameraEnabled.value,
    microphoneEnabled: microphoneEnabled.value,
    cameraId: selectedCameraId.value,
    microphoneId: selectedMicrophoneId.value,
  };

  localStorage.setItem(CALL_SETTINGS_KEY, JSON.stringify(settings));
  sessionStorage.setItem(
    `octo:calls:${roomUsername.value}`,
    JSON.stringify({
      ...settings,
      title: roomTitle.value,
    }),
  );
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  cameraOptions.value = devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      label: device.label || `Камера ${index + 1}`,
      value: device.deviceId,
    }));
  microphoneOptions.value = devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => ({
      label: device.label || `Микрофон ${index + 1}`,
      value: device.deviceId,
    }));

  if (
    selectedCameraId.value &&
    !cameraOptions.value.some((camera) => camera.value === selectedCameraId.value)
  ) {
    selectedCameraId.value = '';
  }

  if (
    selectedMicrophoneId.value &&
    !microphoneOptions.value.some((microphone) => microphone.value === selectedMicrophoneId.value)
  ) {
    selectedMicrophoneId.value = '';
  }

  if (!selectedCameraId.value && cameraOptions.value[0]?.value) {
    selectedCameraId.value = cameraOptions.value[0].value;
  }

  if (!selectedMicrophoneId.value && microphoneOptions.value[0]?.value) {
    selectedMicrophoneId.value = microphoneOptions.value[0].value;
  }
}

async function startCallMedia(action: 'camera' | 'microphone' | 'devices' = 'devices') {
  const requestId = ++mediaRequestId;

  if (!navigator.mediaDevices?.getUserMedia) {
    mediaState.value = 'error';
    errorMessage.value = 'Браузер не поддерживает доступ к камере и микрофону.';
    return;
  }

  mediaState.value = 'checking';
  mediaAction.value = action;
  stopCallMedia();
  errorMessage.value = '';

  try {
    if (!cameraEnabled.value && !microphoneEnabled.value) {
      await refreshDevices();
      mediaState.value = 'ready';
      return;
    }

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: cameraEnabled.value
        ? selectedCameraId.value
          ? { deviceId: { exact: selectedCameraId.value } }
          : true
        : false,
      audio: microphoneEnabled.value ? getMicrophoneConstraints() : false,
    });

    if (requestId !== mediaRequestId) {
      mediaStream.getTracks().forEach((track) => track.stop());
      return;
    }

    stream.value = mediaStream;
    applyTrackState();
    await attachLocalVideo();
    await refreshDevices();
    if (requestId !== mediaRequestId) {
      mediaStream.getTracks().forEach((track) => track.stop());
      return;
    }
    startAudioMeter(mediaStream);
    mediaState.value = 'ready';
  } catch {
    if (requestId !== mediaRequestId) {
      return;
    }

    mediaState.value = 'error';
    errorMessage.value = 'Не удалось подключиться к выбранным устройствам.';
  }
}

async function restartCallMedia(action: 'camera' | 'microphone' | 'devices' = 'devices') {
  await startCallMedia(action);
}

async function restartCallCamera() {
  if (mediaState.value === 'idle') {
    return;
  }

  const requestId = ++cameraRequestId;
  stopCallVideo();

  if (!cameraEnabled.value) {
    mediaState.value = 'ready';
    await attachLocalVideo();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = 'Браузер не поддерживает доступ к камере.';
    return;
  }

  mediaState.value = 'checking';
  mediaAction.value = 'camera';
  errorMessage.value = '';

  try {
    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: selectedCameraId.value ? { deviceId: { exact: selectedCameraId.value } } : true,
      audio: false,
    });

    if (requestId !== cameraRequestId) {
      videoStream.getTracks().forEach((track) => track.stop());
      return;
    }

    const currentStream = stream.value || new MediaStream();
    videoStream.getVideoTracks().forEach((track) => currentStream.addTrack(track));
    stream.value = currentStream;
    await attachLocalVideo();
    await refreshDevices();

    if (requestId !== cameraRequestId) {
      videoStream.getTracks().forEach((track) => track.stop());
      return;
    }

    mediaState.value = 'ready';
  } catch {
    if (requestId !== cameraRequestId) {
      return;
    }

    mediaState.value = 'error';
    isCameraWatcherPaused = true;
    cameraEnabled.value = false;
    isCameraWatcherPaused = false;
    errorMessage.value = 'Не удалось подключить камеру.';
  }
}

async function restartCallMicrophone() {
  if (mediaState.value === 'idle') {
    return;
  }

  const requestId = ++audioRequestId;
  stopCallAudio();

  if (!microphoneEnabled.value) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = 'Браузер не поддерживает доступ к микрофону.';
    return;
  }

  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: getMicrophoneConstraints(),
    });

    if (requestId !== audioRequestId) {
      audioStream.getTracks().forEach((track) => track.stop());
      return;
    }

    const currentStream = stream.value || new MediaStream();
    audioStream.getAudioTracks().forEach((track) => currentStream.addTrack(track));
    stream.value = currentStream;
    startAudioMeter(currentStream);
    await refreshDevices();
  } catch {
    if (requestId !== audioRequestId) {
      return;
    }

    microphoneEnabled.value = false;
    errorMessage.value = 'Не удалось подключить микрофон.';
  }
}

function stopCallMedia() {
  audioRequestId += 1;
  cameraRequestId += 1;
  stopCallAudio();
  stopCallVideo();
  stream.value = null;
}

function stopCallVideo() {
  const currentStream = stream.value;

  currentStream?.getVideoTracks().forEach((track) => {
    track.stop();
    currentStream.removeTrack(track);
  });
}

async function startScreenShare() {
  if (isPageCleanupDone) {
    return;
  }

  const requestId = ++screenRequestId;
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showScreenShareError('Браузер не поддерживает демонстрацию экрана.');
    return;
  }

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    if (requestId !== screenRequestId || isPageCleanupDone) {
      displayStream.getTracks().forEach((track) => track.stop());
      return;
    }
    const [screenTrack] = displayStream.getVideoTracks();

    if (!screenTrack) {
      displayStream.getTracks().forEach((track) => track.stop());
      return;
    }

    screenTrack.addEventListener('ended', () => {
      if (screenStream.value !== displayStream) {
        return;
      }
      stopScreenShare();
      syncPeerTracks();
      announceMediaState();
    });

    screenStream.value?.getTracks().forEach((track) => track.stop());
    screenStream.value = displayStream;
    screenSharing.value = true;
    isCameraWatcherPaused = true;
    cameraEnabled.value = false;
    isCameraWatcherPaused = false;
    stopCallVideo();
    await attachLocalVideo();
    if (requestId !== screenRequestId || isPageCleanupDone) {
      return;
    }
    syncPeerTracks();
    announceMediaState();
  } catch {
    if (requestId !== screenRequestId || isPageCleanupDone) {
      return;
    }
    showScreenShareError('Не удалось начать демонстрацию экрана.');
  }
}

function showScreenShareError(title: string) {
  toast.add({
    title,
    color: 'error',
    icon: 'i-ph-warning-circle-fill',
    progress: false,
    duration: 2400,
    close: false,
  });
}

function stopScreenShare() {
  screenRequestId += 1;
  screenStream.value?.getTracks().forEach((track) => track.stop());
  screenStream.value = null;
  screenSharing.value = false;
  void attachLocalVideo();
}

function stopCallAudio() {
  if (meterFrame) {
    cancelAnimationFrame(meterFrame);
    meterFrame = null;
  }

  audioLevel.value = 0;
  analyser = null;

  if (analyserSource) {
    analyserSource.disconnect();
    analyserSource = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  const currentStream = stream.value;

  currentStream?.getAudioTracks().forEach((track) => {
    track.stop();
    currentStream.removeTrack(track);
  });
}

async function attachLocalVideo() {
  await nextTick();

  const mediaStream = screenStream.value || stream.value;

  if (videoRef.value && videoRef.value.srcObject !== mediaStream) {
    videoRef.value.srcObject = mediaStream;
  }
}

function setLocalVideoRef(element: HTMLVideoElement | null) {
  videoRef.value = element;

  const mediaStream = screenStream.value || stream.value;

  if (element && element.srcObject !== mediaStream) {
    element.srcObject = mediaStream;
  }
}

const localVideoRefSetter = (element: unknown) => {
  setLocalVideoRef(element as HTMLVideoElement | null);
};

function applyTrackState() {
  stream.value?.getVideoTracks().forEach((track) => {
    track.enabled = cameraEnabled.value;
  });

  stream.value?.getAudioTracks().forEach((track) => {
    track.enabled = microphoneEnabled.value;
  });
}

function getMicrophoneConstraints(): MediaTrackConstraints {
  return {
    ...(selectedMicrophoneId.value ? { deviceId: { exact: selectedMicrophoneId.value } } : {}),
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  };
}

function startAudioMeter(mediaStream: MediaStream) {
  const audioTrackStream = new MediaStream(mediaStream.getAudioTracks());

  if (!audioTrackStream.getAudioTracks().length) {
    return;
  }

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  audioContext = new AudioContextConstructor();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyserSource = audioContext.createMediaStreamSource(audioTrackStream);
  analyserSource.connect(analyser);

  const samples = new Uint8Array(analyser.frequencyBinCount);

  function updateMeter() {
    if (!analyser) {
      return;
    }

    analyser.getByteFrequencyData(samples);
    const peak = samples.reduce((max, value) => Math.max(max, value), 0);
    audioLevel.value = microphoneEnabled.value ? Math.min(100, Math.round((peak / 180) * 100)) : 0;
    meterFrame = requestAnimationFrame(updateMeter);
  }

  updateMeter();
}

function setupCallSignaling() {
  unsubscribeSignalHandlers.push(
    websocket.on('client-call.joined', handleCallJoined),
    websocket.on('client-call.left', handleCallLeft),
    websocket.on('client-call.ping', handleCallPing),
    websocket.on('client-call.media-state', handleCallMediaState),
    websocket.on('client-call.offer', handleCallOffer),
    websocket.on('client-call.answer', handleCallAnswer),
    websocket.on('client-call.ice-candidate', handleCallIceCandidate),
  );

  stopWebsocketStatusWatch = watch(
    () => websocket.status,
    (status) => {
      if (status !== 'connected') {
        return;
      }

      websocket.subscribePrivate(callChannel.value);
      announceJoin();
      startPresenceTimers();
    },
    { immediate: true },
  );

  websocket.start();
}

function leaveCallChannel() {
  peerReconnectTimers.forEach((timer) => clearTimeout(timer));
  peerReconnectTimers.clear();
  signalingRetryTimers.forEach((timer) => clearTimeout(timer));
  signalingRetryTimers.clear();

  if (!isJoined.value) {
    stopScreenShare();
    return;
  }

  sendCallEvent('call.left', {}, 0, false);
  isJoined.value = false;
  stopScreenShare();
  unsubscribeSignalHandlers.splice(0).forEach((unsubscribe) => unsubscribe());
  stopWebsocketStatusWatch?.();
  stopWebsocketStatusWatch = null;
  websocket.unsubscribe(callChannel.value);
  stopPresenceTimers();
  peerConnections.forEach((connection) => connection.close());
  peerConnections.clear();
  remoteParticipantSeenAt.clear();
  remoteAudioMeters.forEach((_, participantId) => stopRemoteAudioMeter(participantId));
  remoteVideoRefs.clear();
  remoteVideoRefSetters.clear();
  remoteParticipants.value = [];
}

function handleCallJoined(data: Record<string, unknown>, message: { channel?: string }) {
  if (!isCallMessage(message.channel)) {
    return;
  }

  const payload = data as CallSignalPayload;
  const participant = payload.participant;

  if (!participant || participant.id === clientId) {
    return;
  }

  markParticipantSeen(participant.id);
  closePeerConnection(participant.id);
  upsertParticipant(participant);
  setParticipantConnectionStatus(participant.id, 'connecting');
  clearParticipantStream(participant.id);
  void createOfferForParticipant(participant.id);
  announceMediaState();
}

function handleCallLeft(data: Record<string, unknown>, message: { channel?: string }) {
  if (!isCallMessage(message.channel)) {
    return;
  }

  const payload = data as CallSignalPayload;

  if (!payload.senderId || payload.senderId === clientId) {
    return;
  }

  removeParticipant(payload.senderId);
}

function handleCallPing(data: Record<string, unknown>, message: { channel?: string }) {
  if (!isCallMessage(message.channel)) {
    return;
  }

  const payload = data as CallSignalPayload;
  const participant = payload.participant;

  if (!participant || participant.id === clientId) {
    return;
  }

  markParticipantSeen(participant.id);
  upsertParticipant(participant);
}

function handleCallMediaState(data: Record<string, unknown>, message: { channel?: string }) {
  if (!isCallMessage(message.channel)) {
    return;
  }

  const payload = data as CallSignalPayload;
  const participant = payload.participant;

  if (!participant || participant.id === clientId) {
    return;
  }

  markParticipantSeen(participant.id);
  upsertParticipant(participant);
}

function handleCallOffer(data: Record<string, unknown>, message: { channel?: string }) {
  void (async () => {
    if (!isCallMessage(message.channel)) {
      return;
    }

    const payload = data as CallSignalPayload;

    if (
      !payload.senderId ||
      payload.senderId === clientId ||
      payload.targetId !== clientId ||
      !payload.offer
    ) {
      return;
    }

    if (payload.participant) {
      markParticipantSeen(payload.participant.id);
      upsertParticipant(payload.participant);
      setParticipantConnectionStatus(payload.participant.id, 'connecting');
    }

    const connection = ensurePeerConnection(payload.senderId);
    await connection.setRemoteDescription(payload.offer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    sendCallEvent('call.answer', {
      targetId: payload.senderId,
      answer,
    });
    announceMediaState();
  })();
}

function handleCallAnswer(data: Record<string, unknown>, message: { channel?: string }) {
  void (async () => {
    if (!isCallMessage(message.channel)) {
      return;
    }

    const payload = data as CallSignalPayload;

    if (
      !payload.senderId ||
      payload.senderId === clientId ||
      payload.targetId !== clientId ||
      !payload.answer
    ) {
      return;
    }

    const connection = peerConnections.get(payload.senderId);

    if (!connection || connection.signalingState === 'stable') {
      return;
    }

    markParticipantSeen(payload.senderId);
    await connection.setRemoteDescription(payload.answer);
  })();
}

function handleCallIceCandidate(data: Record<string, unknown>, message: { channel?: string }) {
  void (async () => {
    if (!isCallMessage(message.channel)) {
      return;
    }

    const payload = data as CallSignalPayload;

    if (
      !payload.senderId ||
      payload.senderId === clientId ||
      payload.targetId !== clientId ||
      !payload.candidate
    ) {
      return;
    }

    const connection = peerConnections.get(payload.senderId);

    if (!connection) {
      return;
    }

    markParticipantSeen(payload.senderId);
    await connection.addIceCandidate(payload.candidate);
  })();
}

async function createOfferForParticipant(participantId: string) {
  const connection = ensurePeerConnection(participantId);
  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  sendCallEvent('call.offer', {
    targetId: participantId,
    offer,
  });
}

function ensurePeerConnection(participantId: string) {
  const existingConnection = peerConnections.get(participantId);

  if (existingConnection) {
    return existingConnection;
  }

  const connection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  connection.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    sendCallEvent('call.ice-candidate', {
      targetId: participantId,
      candidate: event.candidate.toJSON(),
    });
  };

  connection.onconnectionstatechange = () => {
    if (peerConnections.get(participantId) !== connection || !isJoined.value) {
      return;
    }
    setParticipantConnectionStatus(
      participantId,
      getParticipantConnectionStatus(connection.connectionState),
    );

    if (['failed', 'disconnected'].includes(connection.connectionState)) {
      schedulePeerReconnect(participantId);
    } else {
      cancelPeerReconnect(participantId);
    }
  };

  connection.ontrack = (event) => {
    const [remoteStream] = event.streams;

    if (!remoteStream) {
      return;
    }

    const participant = remoteParticipants.value.find((item) => item.id === participantId);

    if (participant) {
      participant.stream = remoteStream;
      participant.connectionStatus = 'connected';
    }

    startRemoteAudioMeter(participantId, remoteStream);
    void attachRemoteVideo(participantId, remoteStream);
  };

  addLocalTransceivers(connection);
  peerConnections.set(participantId, connection);

  return connection;
}

function closePeerConnection(participantId: string) {
  cancelPeerReconnect(participantId);
  const connection = peerConnections.get(participantId);
  peerConnections.delete(participantId);
  connection?.close();
  remoteVideoRefs.delete(participantId);
  remoteVideoRefSetters.delete(participantId);
  stopRemoteAudioMeter(participantId);
}

function cancelPeerReconnect(participantId: string) {
  const timer = peerReconnectTimers.get(participantId);
  if (timer !== undefined) {
    clearTimeout(timer);
    peerReconnectTimers.delete(participantId);
  }
}

function schedulePeerReconnect(participantId: string) {
  const connection = peerConnections.get(participantId);
  if (!connection || !isJoined.value || peerReconnectTimers.has(participantId)) {
    return;
  }

  setParticipantConnectionStatus(participantId, 'reconnecting');

  const timer = window.setTimeout(() => {
    if (peerReconnectTimers.get(participantId) !== timer) {
      return;
    }
    peerReconnectTimers.delete(participantId);
    if (
      !isJoined.value ||
      peerConnections.get(participantId) !== connection ||
      !['failed', 'disconnected'].includes(connection.connectionState) ||
      !remoteParticipants.value.some((participant) => participant.id === participantId)
    ) {
      return;
    }

    closePeerConnection(participantId);
    clearParticipantStream(participantId);
    void createOfferForParticipant(participantId);
  }, 1200);
  peerReconnectTimers.set(participantId, timer);
}

function addLocalTransceivers(connection: RTCPeerConnection) {
  const localStream = stream.value;
  const videoTrack =
    screenStream.value?.getVideoTracks()[0] ?? localStream?.getVideoTracks()[0] ?? null;
  const audioTrack = localStream?.getAudioTracks()[0] ?? null;

  if (videoTrack) {
    connection.addTrack(
      videoTrack,
      screenStream.value || localStream || new MediaStream([videoTrack]),
    );
  } else {
    connection.addTransceiver('video', { direction: 'sendrecv' });
  }

  if (audioTrack && localStream) {
    connection.addTrack(audioTrack, localStream);
  } else {
    connection.addTransceiver('audio', { direction: 'sendrecv' });
  }
}

function syncPeerTracks() {
  const localStream = stream.value;
  const videoTrack =
    screenStream.value?.getVideoTracks()[0] ?? localStream?.getVideoTracks()[0] ?? null;
  const audioTrack = localStream?.getAudioTracks()[0] ?? null;

  peerConnections.forEach((connection) => {
    void replaceSenderTrack(connection, 'video', videoTrack);
    void replaceSenderTrack(connection, 'audio', audioTrack);
  });
}

async function replaceSenderTrack(
  connection: RTCPeerConnection,
  kind: 'audio' | 'video',
  track: MediaStreamTrack | null,
) {
  const transceiver = connection
    .getTransceivers()
    .find((item) => item.sender.track?.kind === kind || item.receiver.track.kind === kind);

  if (transceiver) {
    await transceiver.sender.replaceTrack(track);
  }
}

function upsertParticipant(participant: CallParticipantPayload) {
  const existingParticipant = remoteParticipants.value.find((item) => item.id === participant.id);

  if (existingParticipant) {
    existingParticipant.userId = participant.userId;
    existingParticipant.name = participant.name;
    existingParticipant.avatar = participant.avatar;
    existingParticipant.cameraEnabled = participant.cameraEnabled;
    existingParticipant.microphoneEnabled = participant.microphoneEnabled;
    existingParticipant.screenSharing = participant.screenSharing ?? false;
    existingParticipant.joinedAt = participant.joinedAt;
    return;
  }

  remoteParticipants.value.push({
    ...participant,
    screenSharing: participant.screenSharing ?? false,
    stream: null,
    connectionStatus: 'connecting',
    audioLevel: 0,
    isSpeaking: false,
  });
}

function removeParticipant(participantId: string) {
  closePeerConnection(participantId);
  remoteParticipantSeenAt.delete(participantId);
  remoteParticipants.value = remoteParticipants.value.filter(
    (participant) => participant.id !== participantId,
  );
}

function showPreviousParticipantsPage() {
  participantsCarouselPage.value = Math.max(0, participantsCarouselPage.value - 1);
}

function showNextParticipantsPage() {
  participantsCarouselPage.value = Math.min(
    participantPages.value.length - 1,
    participantsCarouselPage.value + 1,
  );
}

function hasParticipantVideo(participant: CallParticipant) {
  if (participant.isLocal) {
    return hasLocalVideo.value;
  }

  return (
    (participant.cameraEnabled || participant.screenSharing) &&
    Boolean(participant.stream?.getVideoTracks().length)
  );
}

function getParticipantVideoClass(participant: CallParticipant) {
  const isScreenShare = participant.isLocal ? screenSharing.value : participant.screenSharing;

  return ['h-full rounded-xs object-contain', isScreenShare ? 'w-full' : 'w-auto max-w-none'];
}

function toggleParticipantOnMain(participantId: string) {
  const nextMainParticipantId = mainParticipantId.value === participantId ? '' : participantId;

  participantsPanelOpen.value = false;
  window.setTimeout(() => {
    mainParticipantId.value = nextMainParticipantId;
    participantsCarouselPage.value = 0;
    void attachLocalVideo();
  });
}

function setParticipantConnectionStatus(
  participantId: string,
  status: ParticipantConnectionStatus,
) {
  const participant = remoteParticipants.value.find((item) => item.id === participantId);

  if (participant) {
    participant.connectionStatus = status;
  }
}

function getParticipantConnectionStatus(
  connectionState: RTCPeerConnectionState,
): ParticipantConnectionStatus {
  if (connectionState === 'connected') {
    return 'connected';
  }

  if (connectionState === 'disconnected' || connectionState === 'failed') {
    return 'reconnecting';
  }

  if (connectionState === 'closed') {
    return 'disconnected';
  }

  return 'connecting';
}

function getConnectionStatusLabel(status: ParticipantConnectionStatus) {
  if (status === 'connected') {
    return 'Подключен';
  }

  if (status === 'reconnecting') {
    return 'Переподключение';
  }

  if (status === 'disconnected') {
    return 'Отключен';
  }

  return 'Подключается';
}

function getConnectionStatusClass(status: ParticipantConnectionStatus) {
  if (status === 'connected') {
    return 'bg-emerald-500';
  }

  if (status === 'reconnecting') {
    return 'bg-amber-500';
  }

  if (status === 'disconnected') {
    return 'bg-neutral-500';
  }

  return 'bg-sky-500';
}

function startRemoteAudioMeter(participantId: string, remoteStream: MediaStream) {
  stopRemoteAudioMeter(participantId);

  const audioTrackStream = new MediaStream(remoteStream.getAudioTracks());

  if (!audioTrackStream.getAudioTracks().length) {
    return;
  }

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  const context = new AudioContextConstructor();
  const analyserNode = context.createAnalyser();
  const source = context.createMediaStreamSource(audioTrackStream);
  const meter: RemoteAudioMeter = {
    context,
    analyser: analyserNode,
    source,
    frame: null,
  };

  analyserNode.fftSize = 256;
  const samples = new Uint8Array(analyserNode.frequencyBinCount);
  source.connect(analyserNode);
  remoteAudioMeters.set(participantId, meter);

  function updateRemoteMeter() {
    const currentMeter = remoteAudioMeters.get(participantId);

    if (!currentMeter) {
      return;
    }

    currentMeter.analyser.getByteFrequencyData(samples);

    const participant = remoteParticipants.value.find((item) => item.id === participantId);
    const peak = samples.reduce((max, value) => Math.max(max, value), 0);
    const level = Math.min(100, Math.round((peak / 180) * 100));

    if (participant) {
      participant.audioLevel = participant.microphoneEnabled ? level : 0;
      participant.isSpeaking = participant.microphoneEnabled && level > 14;
    }

    currentMeter.frame = requestAnimationFrame(updateRemoteMeter);
  }

  updateRemoteMeter();
}

function stopRemoteAudioMeter(participantId: string) {
  const meter = remoteAudioMeters.get(participantId);

  if (!meter) {
    return;
  }

  if (meter.frame) {
    cancelAnimationFrame(meter.frame);
  }

  meter.source.disconnect();
  void meter.context.close();
  remoteAudioMeters.delete(participantId);
}

function clearParticipantStream(participantId: string) {
  const participant = remoteParticipants.value.find((item) => item.id === participantId);

  if (participant) {
    participant.stream = null;
    participant.audioLevel = 0;
    participant.isSpeaking = false;
  }

  stopRemoteAudioMeter(participantId);
}

function announceJoin() {
  sendCallEvent('call.joined');
}

function announceMediaState() {
  sendCallEvent('call.media-state');
}

function announceHeartbeat() {
  sendCallEvent('call.ping', {}, 20, false);
}

function startPresenceTimers() {
  stopPresenceTimers();
  heartbeatTimer = window.setInterval(announceHeartbeat, CALL_HEARTBEAT_INTERVAL_MS);
  staleParticipantsTimer = window.setInterval(removeStaleParticipants, CALL_HEARTBEAT_INTERVAL_MS);
  announceHeartbeat();
}

function stopPresenceTimers() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (staleParticipantsTimer) {
    clearInterval(staleParticipantsTimer);
    staleParticipantsTimer = null;
  }
}

function markParticipantSeen(participantId: string) {
  remoteParticipantSeenAt.set(participantId, Date.now());
}

function removeStaleParticipants() {
  const now = Date.now();

  remoteParticipants.value.forEach((participant) => {
    const lastSeenAt = remoteParticipantSeenAt.get(participant.id) ?? participant.joinedAt;

    if (now - lastSeenAt > CALL_STALE_TIMEOUT_MS) {
      setParticipantConnectionStatus(participant.id, 'disconnected');
      removeParticipant(participant.id);
    }
  });
}

function sendCallEvent(
  event: string,
  payload: Record<string, unknown> = {},
  attempt = 0,
  retry = true,
) {
  if (!isJoined.value) {
    return;
  }
  const sent = websocket.triggerPrivate(callChannel.value, event, {
    ...payload,
    senderId: clientId,
    participant: {
      id: clientId,
      userId: String(auth.user?.id ?? clientId),
      name: userFullName.value,
      avatar: userAvatar.value,
      cameraEnabled: cameraEnabled.value,
      microphoneEnabled: microphoneEnabled.value,
      screenSharing: screenSharing.value,
      joinedAt: localParticipant.value.joinedAt,
    },
  });

  if (sent || !retry || attempt >= 20) {
    return;
  }

  const timer = window.setTimeout(() => {
    if (!signalingRetryTimers.delete(timer)) {
      return;
    }
    sendCallEvent(event, payload, attempt + 1, retry);
  }, 250);
  signalingRetryTimers.add(timer);
}

function isCallMessage(channel?: string) {
  return channel === privateCallChannel.value;
}

async function attachRemoteVideo(participantId: string, remoteStream: MediaStream) {
  await nextTick();

  const videoElement = remoteVideoRefs.get(participantId);

  if (videoElement) {
    videoElement.srcObject = remoteStream;
  }
}

function setRemoteVideoRef(participantId: string, element: HTMLVideoElement | null) {
  if (!element) {
    remoteVideoRefs.delete(participantId);
    return;
  }

  remoteVideoRefs.set(participantId, element);
  const participant = remoteParticipants.value.find((item) => item.id === participantId);

  if (participant?.stream) {
    element.srcObject = participant.stream;
  }
}

function createRemoteVideoRefSetter(participantId: string) {
  const existingSetter = remoteVideoRefSetters.get(participantId);

  if (existingSetter) {
    return existingSetter;
  }

  const setter = (element: unknown) => {
    setRemoteVideoRef(participantId, element as HTMLVideoElement | null);
  };

  remoteVideoRefSetters.set(participantId, setter);

  return setter;
}

function createClientId() {
  if (!import.meta.client) {
    return Math.random().toString(36).slice(2);
  }

  const key = `octo:calls:client:${roomUsername.value}`;
  const savedClientId = sessionStorage.getItem(key);

  if (savedClientId) {
    return savedClientId;
  }

  const nextClientId = createLocalId();

  sessionStorage.setItem(key, nextClientId);

  return nextClientId;
}

function leaveCall() {
  leaveConfirmOpen.value = true;
}

function confirmLeaveCall() {
  leaveConfirmOpen.value = false;
  leaveCallChannel();
}

async function returnToChat() {
  await navigateTo('/');
}

function connectToCall() {
  if (isJoined.value) {
    return;
  }

  saveCallSettings();
  isJoined.value = true;
  setupCallSignaling();
}

async function copyInviteLink() {
  if (!inviteLink.value) {
    return;
  }

  try {
    await copyToClipboard(inviteLink.value);
    toast.add({
      title: 'Ссылка скопирована',
      color: 'success',
      icon: 'i-ph-check-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  } catch {
    toast.add({
      title: 'Не удалось скопировать ссылку',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
}

function toggleCamera() {
  if (screenSharing.value) {
    stopScreenShare();
    cameraEnabled.value = true;
    syncPeerTracks();
    announceMediaState();
    return;
  }

  cameraEnabled.value = !cameraEnabled.value;
}

function toggleScreenShare() {
  if (screenSharing.value) {
    stopScreenShare();
    syncPeerTracks();
    announceMediaState();
    return;
  }

  void startScreenShare();
}
</script>

<template>
  <div class="bg-default text-default flex h-dvh min-h-dvh flex-col overflow-hidden">
    <AppBar v-if="!isJoined">
      <template v-slot:left>
        <UButton
          size="xl"
          color="neutral"
          variant="ghost"
          icon="i-ph-caret-left-bold"
          @click="returnToChat"
        />
      </template>
      <template v-slot:center>{{ roomTitle }}</template>
    </AppBar>
    <main
      class="grid h-full min-h-0 w-full flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]"
      :class="{ 'p-3': isJoined }"
    >
      <section
        class="mx-auto grid min-h-0 w-full max-w-6xl content-center gap-2 overflow-y-auto lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4"
        v-if="!isJoined"
      >
        <div class="space-y-4">
          <div
            class="relative grid aspect-video min-h-52 place-items-center overflow-hidden rounded-xs bg-neutral-950 sm:min-h-64"
          >
            <video
              class="h-full w-auto max-w-none rounded-xs object-contain"
              v-show="cameraEnabled && hasVideo"
              ref="videoRef"
              autoplay
              muted
              playsinline
            />

            <div class="flex flex-col items-center gap-3 text-white" v-if="!cameraEnabled">
              <UAvatar
                class="size-20 text-2xl"
                :src="userAvatar ? $storage(userAvatar) : undefined"
                :alt="userFullName"
                size="3xl"
                img-class="object-cover"
              />
              <div class="text-sm font-semibold">{{ userFullName }}</div>
            </div>

            <div
              class="flex flex-col items-center gap-3 text-white"
              v-else-if="mediaState === 'checking'"
            >
              <UIcon class="size-9 animate-spin" name="i-ph-circle-notch-bold" />
              <div class="text-sm">{{ checkingLabel }}</div>
            </div>

            <div class="flex flex-col items-center gap-3 text-white" v-else-if="!hasVideo">
              <div class="flex size-16 items-center justify-center rounded-lg bg-white/10">
                <UIcon class="size-9" name="i-ph-video-camera-slash-bold" />
              </div>
              <div class="text-sm">Камера недоступна</div>
            </div>
          </div>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            icon="i-ph-warning-circle-bold"
            :description="errorMessage"
          />
        </div>

        <div class="space-y-4">
          <section class="px-3 py-1">
            <div class="text-xl font-bold">{{ roomTitle }}</div>
            <div class="text-muted mt-1 text-sm">
              Перед подключением проверьте камеру и микрофон.
            </div>
          </section>

          <section>
            <div class="bg-elevated rounded-md">
              <UButton
                class="justify-between"
                block
                size="xl"
                color="neutral"
                variant="ghost"
                label="Камера"
                @click="toggleCamera"
              >
                <template v-slot:trailing>
                  <span @click.stop>
                    <USwitch
                      v-model="cameraEnabled"
                      size="xl"
                      checked-icon="i-ph-check-bold"
                      unchecked-icon="i-ph-x-bold"
                    />
                  </span>
                </template>
              </UButton>
              <USelect
                class="w-full"
                v-if="cameraEnabled"
                v-model="selectedCameraId"
                size="xl"
                color="neutral"
                variant="ghost"
                value-key="value"
                :items="cameraOptions"
                :disabled="!cameraOptions.length"
                placeholder="Камера не найдена"
              />
            </div>
          </section>

          <section>
            <div class="bg-elevated rounded-md">
              <UButton
                class="justify-between"
                block
                size="xl"
                color="neutral"
                variant="ghost"
                label="Микрофон"
                @click="microphoneEnabled = !microphoneEnabled"
              >
                <template v-slot:trailing>
                  <span @click.stop>
                    <USwitch
                      v-model="microphoneEnabled"
                      size="xl"
                      checked-icon="i-ph-check-bold"
                      unchecked-icon="i-ph-x-bold"
                    />
                  </span>
                </template>
              </UButton>
              <USelect
                class="w-full"
                v-if="microphoneEnabled"
                v-model="selectedMicrophoneId"
                size="xl"
                color="neutral"
                variant="ghost"
                value-key="value"
                :items="microphoneOptions"
                :disabled="!microphoneOptions.length"
                placeholder="Микрофон не найден"
              />
              <div class="p-3 px-3" v-if="microphoneEnabled">
                <div class="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    class="bg-primary h-full rounded-full transition-[width]"
                    :style="{ width: `${audioLevel}%` }"
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <div class="px-3 py-1 text-base font-bold">Ссылка-приглашение</div>
            <UButton
              class="justify-start"
              block
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-link-bold"
              :label="inviteLink || 'Ссылка еще не создана'"
              @click="copyInviteLink"
            />
          </section>

          <UButton block size="xl" color="primary" :disabled="!canConnect" @click="connectToCall">
            Подключиться
          </UButton>
        </div>
      </section>

      <template v-else>
        <section class="flex min-h-0 flex-col gap-2 overflow-hidden">
          <div
            class="relative grid min-h-0 flex-1 cursor-pointer rounded-xs ring-0 transition-shadow"
            v-if="mainParticipant"
            :key="`main-${mainParticipant.id}`"
            :class="
              mainParticipant.isSpeaking
                ? 'ring-primary ring-2 ring-offset-2 ring-offset-(--ui-bg)'
                : ''
            "
            role="button"
            tabindex="0"
            @click="toggleParticipantOnMain(mainParticipant.id)"
            @keydown.enter.prevent="toggleParticipantOnMain(mainParticipant.id)"
            @keydown.space.prevent="toggleParticipantOnMain(mainParticipant.id)"
          >
            <div
              class="relative grid min-h-0 place-items-center overflow-hidden rounded-xs bg-neutral-950"
            >
              <video
                v-if="mainParticipant.isLocal"
                v-show="hasParticipantVideo(mainParticipant)"
                :ref="localVideoRefSetter"
                autoplay
                muted
                playsinline
                :class="getParticipantVideoClass(mainParticipant)"
              />
              <video
                v-else
                v-show="hasParticipantVideo(mainParticipant)"
                :ref="createRemoteVideoRefSetter(mainParticipant.id)"
                autoplay
                playsinline
                :class="getParticipantVideoClass(mainParticipant)"
              />

              <div
                class="flex flex-col items-center gap-3 text-white"
                v-if="!hasParticipantVideo(mainParticipant)"
              >
                <UAvatar
                  class="size-24 text-3xl"
                  :src="mainParticipant.avatar ? $storage(mainParticipant.avatar) : undefined"
                  :alt="mainParticipant.name"
                  size="3xl"
                  img-class="object-cover"
                />
                <div class="text-sm font-semibold">{{ mainParticipant.name }}</div>
              </div>

              <div
                class="flex flex-col items-center gap-3 text-white"
                v-else-if="
                  mainParticipant.isLocal &&
                  !screenSharing &&
                  cameraEnabled &&
                  mediaState === 'checking'
                "
              >
                <UIcon class="size-11 animate-spin" name="i-ph-circle-notch-bold" />
                <div class="text-sm">{{ checkingLabel }}</div>
              </div>

              <div
                class="flex flex-col items-center gap-3 text-white"
                v-else-if="mainParticipant.isLocal && !screenSharing && cameraEnabled && !hasVideo"
              >
                <div class="flex size-20 items-center justify-center rounded-lg bg-white/10">
                  <UIcon class="size-11" name="i-ph-video-camera-slash-bold" />
                </div>
                <div class="text-sm">Камера недоступна</div>
              </div>
            </div>
          </div>

          <div
            class="grid gap-2"
            v-if="currentParticipantPage.length"
            :class="[
              thumbnailGridClass,
              mainParticipant ? 'h-24 shrink-0 md:h-32' : 'min-h-0 flex-1 auto-rows-fr',
              isSingleParticipantGrid ? 'place-items-center' : '',
            ]"
          >
            <div
              class="relative grid min-h-0 cursor-pointer rounded-xs ring-0 transition-shadow"
              v-for="participant in currentParticipantPage"
              :key="`${mainParticipant ? 'thumb' : 'grid'}-${participant.id}`"
              :class="[
                participant.isSpeaking
                  ? 'ring-primary ring-2 ring-offset-2 ring-offset-(--ui-bg)'
                  : '',
                isSingleParticipantGrid ? 'h-full w-full max-w-6xl' : '',
              ]"
              role="button"
              tabindex="0"
              @click="toggleParticipantOnMain(participant.id)"
              @keydown.enter.prevent="toggleParticipantOnMain(participant.id)"
              @keydown.space.prevent="toggleParticipantOnMain(participant.id)"
            >
              <div
                class="relative grid min-h-0 place-items-center overflow-hidden rounded-xs bg-neutral-950"
              >
                <video
                  v-if="participant.isLocal"
                  v-show="hasParticipantVideo(participant)"
                  :ref="localVideoRefSetter"
                  autoplay
                  muted
                  playsinline
                  :class="getParticipantVideoClass(participant)"
                />
                <video
                  v-else
                  v-show="hasParticipantVideo(participant)"
                  :ref="createRemoteVideoRefSetter(participant.id)"
                  autoplay
                  playsinline
                  :class="getParticipantVideoClass(participant)"
                />

                <div
                  class="flex flex-col items-center gap-3 text-white"
                  v-if="!hasParticipantVideo(participant)"
                >
                  <UAvatar
                    :src="participant.avatar ? $storage(participant.avatar) : undefined"
                    :alt="participant.name"
                    size="3xl"
                    img-class="object-cover"
                    :class="
                      mainParticipant ? 'size-12 text-lg md:size-14 md:text-xl' : 'size-24 text-3xl'
                    "
                  />
                  <div class="font-semibold" :class="mainParticipant ? 'text-xs' : 'text-sm'">
                    {{ participant.name }}
                  </div>
                </div>

                <div
                  class="flex flex-col items-center gap-3 text-white"
                  v-else-if="
                    participant.isLocal &&
                    !screenSharing &&
                    cameraEnabled &&
                    mediaState === 'checking'
                  "
                >
                  <UIcon class="size-11 animate-spin" name="i-ph-circle-notch-bold" />
                  <div class="text-sm">{{ checkingLabel }}</div>
                </div>

                <div
                  class="flex flex-col items-center gap-3 text-white"
                  v-else-if="participant.isLocal && !screenSharing && cameraEnabled && !hasVideo"
                >
                  <div class="flex size-20 items-center justify-center rounded-lg bg-white/10">
                    <UIcon class="size-11" name="i-ph-video-camera-slash-bold" />
                  </div>
                  <div class="text-sm">Камера недоступна</div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center justify-center gap-2" v-if="hasParticipantPages">
            <UButton
              icon="i-ph-caret-left-bold"
              size="xs"
              color="neutral"
              variant="soft"
              :disabled="participantsCarouselPage === 0"
              @click="showPreviousParticipantsPage"
            />
            <UBadge color="neutral" variant="soft" size="md">
              {{ participantsCarouselPage + 1 }} / {{ participantPages.length }}
            </UBadge>
            <UButton
              icon="i-ph-caret-right-bold"
              size="xs"
              color="neutral"
              variant="soft"
              :disabled="participantsCarouselPage >= participantPages.length - 1"
              @click="showNextParticipantsPage"
            />
          </div>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            icon="i-ph-warning-circle-bold"
            :description="errorMessage"
          />

          <div class="flex items-center justify-center gap-2">
            <UButton
              :icon="microphoneEnabled ? 'i-ph-microphone-bold' : 'i-ph-microphone-slash-bold'"
              size="xl"
              color="neutral"
              :variant="microphoneEnabled ? 'soft' : 'solid'"
              @click="microphoneEnabled = !microphoneEnabled"
            />
            <UButton
              :icon="cameraEnabled ? 'i-ph-video-camera-bold' : 'i-ph-video-camera-slash-bold'"
              size="xl"
              color="neutral"
              :variant="cameraEnabled ? 'soft' : 'solid'"
              @click="toggleCamera"
            />
            <UButton
              :icon="screenSharing ? 'i-ph-monitor-arrow-up-fill' : 'i-ph-monitor-arrow-up-bold'"
              size="xl"
              color="neutral"
              :variant="screenSharing ? 'solid' : 'soft'"
              @click="toggleScreenShare"
            />
            <UButton
              class="lg:hidden"
              icon="i-ph-users-bold"
              size="xl"
              color="neutral"
              variant="soft"
              @click="participantsPanelOpen = true"
            >
              <template #trailing>
                <UBadge color="neutral" variant="soft" size="sm">{{ participantsCount }}</UBadge>
              </template>
            </UButton>
            <UButton icon="i-ph-phone-disconnect-bold" size="xl" color="error" @click="leaveCall" />
          </div>
        </section>

        <aside
          class="border-default bg-elevated/40 hidden min-h-0 flex-col rounded-md border lg:flex"
        >
          <div class="border-default flex items-center justify-between border-b px-4 py-3">
            <div>
              <div class="text-sm font-semibold">{{ roomTitle }}</div>
              <div class="text-muted text-xs">Канал @{{ roomUsername }}</div>
            </div>
            <UBadge color="neutral" variant="soft">{{ participantsCount }}</UBadge>
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            <Item no-hover no-cursor>
              <template #avatar>
                <UAvatar
                  :src="userAvatar ? $storage(userAvatar) : undefined"
                  :alt="userFullName"
                  size="3xl"
                  img-class="object-cover"
                />
              </template>

              <template #heading>
                {{ userFullName }}
              </template>

              <template #description>
                <span class="flex items-center gap-1.5">
                  <span
                    class="size-1.5 rounded-full"
                    :class="getConnectionStatusClass(localConnectionStatus)"
                  />
                  {{
                    localIsSpeaking ? 'Говорите' : getConnectionStatusLabel(localConnectionStatus)
                  }}
                </span>
              </template>

              <template #action>
                <div class="flex items-center gap-1.5">
                  <UIcon class="text-primary" v-if="localIsSpeaking" name="i-ph-waveform-bold" />
                  <UIcon
                    :name="
                      microphoneEnabled ? 'i-ph-microphone-bold' : 'i-ph-microphone-slash-bold'
                    "
                  />
                  <UIcon
                    :name="
                      cameraEnabled ? 'i-ph-video-camera-bold' : 'i-ph-video-camera-slash-bold'
                    "
                  />
                  <UIcon v-if="screenSharing" name="i-ph-monitor-arrow-up-bold" />
                </div>
              </template>
            </Item>

            <Item
              v-for="participant in remoteParticipants"
              :key="participant.id"
              no-hover
              no-cursor
            >
              <template #avatar>
                <UAvatar
                  :src="participant.avatar ? $storage(participant.avatar) : undefined"
                  :alt="participant.name"
                  size="3xl"
                  img-class="object-cover"
                />
              </template>

              <template #heading>
                {{ participant.name }}
              </template>

              <template #description>
                <span class="flex items-center gap-1.5">
                  <span
                    class="size-1.5 rounded-full"
                    :class="getConnectionStatusClass(participant.connectionStatus)"
                  />
                  {{
                    participant.isSpeaking
                      ? 'Говорит'
                      : getConnectionStatusLabel(participant.connectionStatus)
                  }}
                </span>
              </template>

              <template #action>
                <div class="flex items-center gap-1.5">
                  <UIcon
                    class="text-primary"
                    v-if="participant.isSpeaking"
                    name="i-ph-waveform-bold"
                  />
                  <UIcon
                    :name="
                      participant.microphoneEnabled
                        ? 'i-ph-microphone-bold'
                        : 'i-ph-microphone-slash-bold'
                    "
                  />
                  <UIcon
                    :name="
                      participant.cameraEnabled
                        ? 'i-ph-video-camera-bold'
                        : 'i-ph-video-camera-slash-bold'
                    "
                  />
                  <UIcon v-if="participant.screenSharing" name="i-ph-monitor-arrow-up-bold" />
                </div>
              </template>
            </Item>
          </div>
        </aside>

        <USlideover
          v-model:open="participantsPanelOpen"
          side="right"
          title="Участники"
          :description="roomTitle"
        >
          <template #content>
            <div class="flex h-full min-h-0 flex-col">
              <div class="border-default flex items-center justify-between border-b px-4 py-3">
                <div>
                  <div class="text-sm font-semibold">{{ roomTitle }}</div>
                  <div class="text-muted text-xs">Канал @{{ roomUsername }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge color="neutral" variant="soft">{{ participantsCount }}</UBadge>
                  <UButton
                    icon="i-ph-x-bold"
                    size="lg"
                    color="neutral"
                    variant="ghost"
                    @click="participantsPanelOpen = false"
                  />
                </div>
              </div>

              <div class="min-h-0 flex-1 overflow-auto">
                <Item no-hover no-cursor>
                  <template #avatar>
                    <UAvatar
                      :src="userAvatar ? $storage(userAvatar) : undefined"
                      :alt="userFullName"
                      size="3xl"
                      img-class="object-cover"
                    />
                  </template>

                  <template #heading>
                    {{ userFullName }}
                  </template>

                  <template #description>
                    <span class="flex items-center gap-1.5">
                      <span
                        class="size-1.5 rounded-full"
                        :class="getConnectionStatusClass(localConnectionStatus)"
                      />
                      {{
                        localIsSpeaking
                          ? 'Говорите'
                          : getConnectionStatusLabel(localConnectionStatus)
                      }}
                    </span>
                  </template>

                  <template #action>
                    <div class="flex items-center gap-1.5">
                      <UIcon
                        class="text-primary"
                        v-if="localIsSpeaking"
                        name="i-ph-waveform-bold"
                      />
                      <UIcon
                        :name="
                          microphoneEnabled ? 'i-ph-microphone-bold' : 'i-ph-microphone-slash-bold'
                        "
                      />
                      <UIcon
                        :name="
                          cameraEnabled ? 'i-ph-video-camera-bold' : 'i-ph-video-camera-slash-bold'
                        "
                      />
                      <UIcon v-if="screenSharing" name="i-ph-monitor-arrow-up-bold" />
                    </div>
                  </template>
                </Item>

                <Item
                  v-for="participant in remoteParticipants"
                  :key="participant.id"
                  no-hover
                  no-cursor
                >
                  <template #avatar>
                    <UAvatar
                      :src="participant.avatar ? $storage(participant.avatar) : undefined"
                      :alt="participant.name"
                      size="3xl"
                      img-class="object-cover"
                    />
                  </template>

                  <template #heading>
                    {{ participant.name }}
                  </template>

                  <template #description>
                    <span class="flex items-center gap-1.5">
                      <span
                        class="size-1.5 rounded-full"
                        :class="getConnectionStatusClass(participant.connectionStatus)"
                      />
                      {{
                        participant.isSpeaking
                          ? 'Говорит'
                          : getConnectionStatusLabel(participant.connectionStatus)
                      }}
                    </span>
                  </template>

                  <template #action>
                    <div class="flex items-center gap-1.5">
                      <UIcon
                        class="text-primary"
                        v-if="participant.isSpeaking"
                        name="i-ph-waveform-bold"
                      />
                      <UIcon
                        :name="
                          participant.microphoneEnabled
                            ? 'i-ph-microphone-bold'
                            : 'i-ph-microphone-slash-bold'
                        "
                      />
                      <UIcon
                        :name="
                          participant.cameraEnabled
                            ? 'i-ph-video-camera-bold'
                            : 'i-ph-video-camera-slash-bold'
                        "
                      />
                      <UIcon v-if="participant.screenSharing" name="i-ph-monitor-arrow-up-bold" />
                    </div>
                  </template>
                </Item>
              </div>
            </div>
          </template>
        </USlideover>
      </template>
    </main>

    <UModal
      v-model:open="leaveConfirmOpen"
      title="Выйти из звонка"
      description="Подтвердите выход из встречи"
    >
      <template #content>
        <div class="space-y-4 p-4">
          <div class="space-y-1">
            <div class="text-lg font-semibold">Выйти из звонка?</div>
            <div class="text-muted text-sm">
              Вы отключитесь от встречи и вернетесь к настройкам перед входом.
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="leaveConfirmOpen = false"
            />
            <UButton
              color="error"
              label="Выйти"
              icon="i-ph-phone-disconnect-bold"
              @click="confirmLeaveCall"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
