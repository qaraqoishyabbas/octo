export type CallSettings = {
  cameraEnabled?: boolean;
  microphoneEnabled?: boolean;
  cameraId?: string;
  microphoneId?: string;
  title?: string;
};

export type DeviceOption = {
  label: string;
  value: string;
};

export type ParticipantConnectionStatus =
  'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type CallParticipant = {
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

export type CallParticipantPayload = Pick<
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

export type CallSignalPayload = {
  senderId?: string;
  targetId?: string;
  participant?: CallParticipantPayload;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export type RemoteAudioMeter = {
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  frame: number | null;
};

export type CallRoomOptions = {
  autoJoin?: boolean;
  onLeave?: () => void | Promise<unknown>;
};
