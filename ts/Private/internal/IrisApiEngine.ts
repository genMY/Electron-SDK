import EventEmitter from 'eventemitter3';
import JSON from 'json-bigint';

import { AgoraEnv, logDebug, logError, logInfo, logWarn } from '../../Utils';
import { IAudioEncodedFrameObserver } from '../AgoraBase';
import {
  AudioFrame,
  AudioPcmFrame,
  IAudioFrameObserver,
  IAudioPcmFrameSink,
  IAudioSpectrumObserver,
  IMediaRecorderObserver,
  IVideoEncodedFrameObserver,
  IVideoFrameObserver,
  VideoFrame,
} from '../AgoraMediaBase';
import {
  IMediaPlayer,
  IMediaPlayerVideoFrameObserver,
} from '../IAgoraMediaPlayer';
import { IMediaPlayerSourceObserver } from '../IAgoraMediaPlayerSource';
import {
  IMusicContentCenterEventHandler,
  MusicCollection,
} from '../IAgoraMusicContentCenter';
import {
  IDirectCdnStreamingEventHandler,
  IMetadataObserver,
  IRtcEngineEventHandler,
  Metadata,
} from '../IAgoraRtcEngine';
import { processIAudioEncodedFrameObserver } from '../impl/AgoraBaseImpl';
import {
  processIAudioFrameObserver,
  processIAudioFrameObserverBase,
  processIAudioPcmFrameSink,
  processIAudioSpectrumObserver,
  processIMediaRecorderObserver,
  processIVideoEncodedFrameObserver,
  processIVideoFrameObserver,
} from '../impl/AgoraMediaBaseImpl';
import { processIMediaPlayerVideoFrameObserver } from '../impl/IAgoraMediaPlayerImpl';
import { processIMediaPlayerSourceObserver } from '../impl/IAgoraMediaPlayerSourceImpl';
import { processIMusicContentCenterEventHandler } from '../impl/IAgoraMusicContentCenterImpl';
import {
  processIDirectCdnStreamingEventHandler,
  processIMetadataObserver,
  processIRtcEngineEventHandler,
} from '../impl/IAgoraRtcEngineImpl';

import { MediaEngineInternal } from './MediaEngineInternal';
import { MediaPlayerInternal } from './MediaPlayerInternal';
import { MediaRecorderInternal } from './MediaRecorderInternal';
import {
  MusicCollectionInternal,
  MusicContentCenterInternal,
} from './MusicContentCenterInternal';
import { RtcEngineExInternal } from './RtcEngineExInternal';

// @ts-ignore
export const DeviceEventEmitter: EventEmitter = new EventEmitter();

const AgoraRtcNg = AgoraEnv.AgoraElectronBridge;
AgoraRtcNg.OnEvent('call_back_with_buffer', (...params: any) => {
  try {
    handleEvent(...params);
  } catch (e) {
    console.error(e);
  }
});

/**
 * @internal
 */
export function setDebuggable(flag: boolean) {
  AgoraEnv.enableLogging = flag;
  AgoraEnv.enableDebugLogging = flag;
}

/**
 * @internal
 */
export function isDebuggable() {
  return AgoraEnv.enableLogging && AgoraEnv.enableDebugLogging;
}

/**
 * @internal
 */
export type EventProcessor<T extends ProcessorType> = {
  suffix: string;
  type: (data: any) => EVENT_TYPE;
  func: Function[];
  preprocess?: (event: string, data: any, buffers: Uint8Array[]) => void;
  handlers: (
    event: string,
    data: any,
    buffers: Uint8Array[]
  ) => (T | undefined)[] | undefined;
};

export enum EVENT_TYPE {
  IMediaEngine,
  IMediaPlayer,
  IMediaRecorder,
  IRtcEngine,
  IMusicContentCenter,
}

type ProcessorType =
  | IAudioFrameObserver
  | IVideoFrameObserver
  | IAudioSpectrumObserver
  | IAudioEncodedFrameObserver
  | IVideoEncodedFrameObserver
  | IMediaPlayerSourceObserver
  | IAudioPcmFrameSink
  | IMediaPlayerVideoFrameObserver
  | IMediaRecorderObserver
  | IMetadataObserver
  | IDirectCdnStreamingEventHandler
  | IRtcEngineEventHandler
  | IMusicContentCenterEventHandler;

type EventProcessors = {
  IAudioFrameObserver: EventProcessor<IAudioFrameObserver>;
  IVideoFrameObserver: EventProcessor<IVideoFrameObserver>;
  IAudioSpectrumObserver: EventProcessor<IAudioSpectrumObserver>;
  IAudioEncodedFrameObserver: EventProcessor<IAudioEncodedFrameObserver>;
  IVideoEncodedFrameObserver: EventProcessor<IVideoEncodedFrameObserver>;
  IMediaPlayerSourceObserver: EventProcessor<IMediaPlayerSourceObserver>;
  IAudioPcmFrameSink: EventProcessor<IAudioPcmFrameSink>;
  IMediaPlayerVideoFrameObserver: EventProcessor<IMediaPlayerVideoFrameObserver>;
  IMediaRecorderObserver: EventProcessor<IMediaRecorderObserver>;
  IMetadataObserver: EventProcessor<IMetadataObserver>;
  IDirectCdnStreamingEventHandler: EventProcessor<IDirectCdnStreamingEventHandler>;
  IRtcEngineEventHandler: EventProcessor<IRtcEngineEventHandler>;
  IMusicContentCenterEventHandler: EventProcessor<IMusicContentCenterEventHandler>;
};

/**
 * @internal
 */
export const EVENT_PROCESSORS: EventProcessors = {
  IAudioFrameObserver: {
    suffix: 'AudioFrameObserver_',
    type: () => EVENT_TYPE.IMediaEngine,
    func: [processIAudioFrameObserver, processIAudioFrameObserverBase],
    preprocess: (
      event: string,
      data: { audioFrame?: AudioFrame },
      buffers: Uint8Array[]
    ) => {
      if (data.audioFrame) {
        data.audioFrame.buffer = buffers[0];
      }
    },
    handlers: (event: string, data: any) =>
      MediaEngineInternal._audio_frame_observers,
  },
  IVideoFrameObserver: {
    suffix: 'VideoFrameObserver_',
    type: () => EVENT_TYPE.IMediaEngine,
    func: [processIVideoFrameObserver],
    preprocess: (
      event: string,
      data: { videoFrame?: VideoFrame },
      buffers: Uint8Array[]
    ) => {
      if (data.videoFrame) {
        data.videoFrame.yBuffer = buffers[0];
        data.videoFrame.uBuffer = buffers[1];
        data.videoFrame.vBuffer = buffers[2];
        data.videoFrame.metadata_buffer = buffers[3];
        data.videoFrame.alphaBuffer = buffers[4];
      }
    },
    handlers: (event: string, data: any) =>
      MediaEngineInternal._video_frame_observers,
  },
  IAudioSpectrumObserver: {
    suffix: 'AudioSpectrumObserver_',
    type: (data: any) =>
      data.playerId === 0 ? EVENT_TYPE.IRtcEngine : EVENT_TYPE.IMediaPlayer,
    func: [processIAudioSpectrumObserver],
    handlers: (event: string, data: any) =>
      data.playerId === 0
        ? RtcEngineExInternal._audio_spectrum_observers
        : MediaPlayerInternal._audio_spectrum_observers.get(data.playerId),
  },
  IAudioEncodedFrameObserver: {
    suffix: 'AudioEncodedFrameObserver_',
    type: () => EVENT_TYPE.IRtcEngine,
    func: [processIAudioEncodedFrameObserver],
    preprocess: (
      event: string,
      data: {
        frameBuffer?: Uint8Array;
      },
      buffers: Uint8Array[]
    ) => {
      switch (event) {
        case 'OnRecordAudioEncodedFrame':
        case 'OnPlaybackAudioEncodedFrame':
        case 'OnMixedAudioEncodedFrame':
          data.frameBuffer = buffers[0];
          break;
      }
    },
    handlers: (event: string, data: any) =>
      RtcEngineExInternal._audio_encoded_frame_observers,
  },
  IVideoEncodedFrameObserver: {
    suffix: 'VideoEncodedFrameObserver_',
    type: () => EVENT_TYPE.IMediaEngine,
    func: [processIVideoEncodedFrameObserver],
    preprocess: (
      event: string,
      data: {
        imageBuffer?: Uint8Array;
      },
      buffers: Uint8Array[]
    ) => {
      switch (event) {
        case 'onEncodedVideoFrameReceived':
          data.imageBuffer = buffers[0];
          break;
      }
    },
    handlers: (event: string, data: any) =>
      MediaEngineInternal._video_encoded_frame_observers,
  },
  IMediaPlayerSourceObserver: {
    suffix: 'MediaPlayerSourceObserver_',
    type: () => EVENT_TYPE.IMediaPlayer,
    func: [processIMediaPlayerSourceObserver],
    handlers: (event: string, data: any) =>
      MediaPlayerInternal._source_observers.get(data.playerId),
  },
  IAudioPcmFrameSink: {
    suffix: 'AudioPcmFrameSink_',
    type: () => EVENT_TYPE.IMediaPlayer,
    func: [processIAudioPcmFrameSink],
    preprocess: (
      event: string,
      data: { frame?: AudioPcmFrame },
      buffers: Uint8Array[]
    ) => {
      if (data.frame) {
        data.frame.data_ = Array.from(buffers[0] ?? []);
      }
    },
    handlers: (event: string, data: any) =>
      MediaPlayerInternal._audio_frame_observers.get(data.playerId),
  },
  IMediaPlayerVideoFrameObserver: {
    suffix: 'MediaPlayerVideoFrameObserver_',
    type: () => EVENT_TYPE.IMediaPlayer,
    func: [processIMediaPlayerVideoFrameObserver],
    preprocess: (
      event: string,
      data: { frame?: VideoFrame },
      buffers: Uint8Array[]
    ) => {
      if (data.frame) {
        data.frame.yBuffer = buffers[0];
        data.frame.uBuffer = buffers[1];
        data.frame.vBuffer = buffers[2];
        data.frame.metadata_buffer = buffers[3];
        data.frame.alphaBuffer = buffers[4];
      }
    },
    handlers: (event: string, data: any) =>
      MediaPlayerInternal._video_frame_observers.get(data.playerId),
  },
  IMediaRecorderObserver: {
    suffix: 'MediaRecorderObserver_',
    type: () => EVENT_TYPE.IMediaRecorder,
    func: [processIMediaRecorderObserver],
    handlers: (event: string, data: any) => [
      MediaRecorderInternal._observers.get(data.nativeHandle),
    ],
  },
  IMetadataObserver: {
    suffix: 'MetadataObserver_',
    type: () => EVENT_TYPE.IRtcEngine,
    func: [processIMetadataObserver],
    preprocess: (
      event: string,
      data: { metadata?: Metadata },
      buffers: Uint8Array[]
    ) => {
      switch (event) {
        case 'onMetadataReceived':
          if (data.metadata) {
            data.metadata.buffer = buffers[0];
          }
          break;
      }
    },
    handlers: (event: string, data: any) =>
      RtcEngineExInternal._metadata_observer,
  },
  IDirectCdnStreamingEventHandler: {
    suffix: 'DirectCdnStreamingEventHandler_',
    type: () => EVENT_TYPE.IRtcEngine,
    func: [processIDirectCdnStreamingEventHandler],
    handlers: (event: string, data: any) =>
      RtcEngineExInternal._direct_cdn_streaming_event_handler,
  },
  IRtcEngineEventHandler: {
    suffix: 'RtcEngineEventHandler_',
    type: () => EVENT_TYPE.IRtcEngine,
    func: [processIRtcEngineEventHandler],
    preprocess: (
      event: string,
      data: { data?: Uint8Array },
      buffers: Uint8Array[]
    ) => {
      switch (event) {
        case 'onStreamMessage':
        case 'onStreamMessageEx':
          data.data = buffers[0];
          break;
      }
    },
    handlers: (event: string, data: any) => {
      if (event === 'onLocalVideoStats' && 'connection' in data) {
        return undefined;
      }
      return RtcEngineExInternal._event_handlers;
    },
  },
  IMusicContentCenterEventHandler: {
    suffix: 'MusicContentCenterEventHandler_',
    type: () => EVENT_TYPE.IMusicContentCenter,
    func: [processIMusicContentCenterEventHandler],
    preprocess: (
      event: string,
      data: { result: MusicCollection },
      buffers: Uint8Array[]
    ) => {
      switch (event) {
        case 'onMusicCollectionResult': {
          const result = data.result;
          data.result = new MusicCollectionInternal(result);
          break;
        }
      }
    },
    handlers: (event: string, data: any) =>
      MusicContentCenterInternal._event_handlers,
  },
};

function handleEvent(...[event, data, buffers]: any) {
  if (isDebuggable()) {
    logInfo('onEvent', event, data, buffers);
  }

  let _event: string = event;
  let processor: EventProcessor<any> | undefined = Object.values(
    EVENT_PROCESSORS
  ).find((it) => {
    return _event.startsWith(it.suffix);
  });

  if (processor === undefined) {
    return;
  }

  // allow replace preprocess to undefined for avoid call more than once
  processor = { ...processor };

  const reg = new RegExp(`^${processor.suffix}`, 'g');
  _event = _event.replace(reg, '');
  if (_event.endsWith('Ex')) {
    _event = _event.replace(/Ex$/g, '');
  }

  let _data: any;
  try {
    _data = JSON.parse(data) ?? {};
  } catch (e) {
    _data = {};
  }

  const _buffers: Uint8Array[] = buffers;

  if (processor.handlers) {
    const handlers = processor.handlers(_event, _data, _buffers);
    if (handlers !== undefined) {
      if (processor.preprocess) {
        processor.preprocess(_event, _data, _buffers);
        // call preprocess only once
        processor.preprocess = undefined;
      }
      handlers.map((value) => {
        if (value) {
          processor!.func.map((it) => {
            it(value, _event, _data);
          });
        }
      });
    }
  }

  emitEvent(_event, processor, _data, _buffers);
}

/**
 * @internal
 */
export function callIrisApi(funcName: string, params: any): any {
  try {
    const buffers: Uint8Array[] = [];

    if (funcName.startsWith('MediaEngine_')) {
      switch (funcName) {
        case 'MediaEngine_pushAudioFrame':
        case 'MediaEngine_pushCaptureAudioFrame':
        case 'MediaEngine_pushReverseAudioFrame':
        case 'MediaEngine_pushDirectAudioFrame':
          // frame.buffer
          buffers.push(params.frame.buffer);
          break;
        case 'MediaEngine_pushVideoFrame':
          // frame.buffer
          buffers.push(params.frame.buffer);
          // frame.eglContext
          buffers.push(Buffer.from(''));
          // frame.metadata_buffer
          buffers.push(Buffer.from(''));
          // frame.alphaBuffer
          buffers.push(params.frame.alphaBuffer);
          // frame.d3d11_texture_2d
          buffers.push(Buffer.from(''));
          break;
        case 'MediaEngine_pushEncodedVideoImage':
          // imageBuffer
          buffers.push(params.imageBuffer);
          break;
      }
    } else if (
      funcName.startsWith('MediaPlayer_') ||
      funcName.startsWith('MusicPlayer_')
    ) {
      // @ts-ignore
      params.mediaPlayerId = (this as IMediaPlayer).getMediaPlayerId();
      const json = params.toJSON?.call();
      params.toJSON = function () {
        return { ...json, playerId: params.mediaPlayerId };
      };
    } else if (funcName.startsWith('MediaRecorder_')) {
      // @ts-ignore
      params.nativeHandle = (this as MediaRecorderInternal).nativeHandle;
      const json = params.toJSON?.call();
      params.toJSON = function () {
        return { ...json, nativeHandle: params.nativeHandle };
      };
    } else if (funcName.startsWith('RtcEngine_')) {
      switch (funcName) {
        case 'RtcEngine_initialize':
          AgoraRtcNg.InitializeEnv();
          break;
        case 'RtcEngine_release':
          AgoraRtcNg.CallApi(
            funcName,
            JSON.stringify(params),
            buffers,
            buffers.length
          );
          AgoraRtcNg.ReleaseEnv();
          return;
        case 'RtcEngine_sendMetaData':
          // metadata.buffer
          buffers.push(params.metadata.buffer);
          break;
        case 'RtcEngine_sendStreamMessage':
        case 'RtcEngine_sendStreamMessageEx':
          // data
          buffers.push(params.data);
          break;
        case 'RtcEngine_destroyMediaPlayer':
          params.mediaPlayerId = params.media_player.getMediaPlayerId();
          params.toJSON = function () {
            return { playerId: params.mediaPlayerId };
          };
          break;
        case 'RtcEngine_destroyMediaRecorder':
          // @ts-ignore
          params.nativeHandle = (this as MediaRecorderInternal).nativeHandle;
          params.toJSON = function () {
            return { nativeHandle: params.nativeHandle };
          };
          break;
      }
    }

    let { callApiReturnCode, callApiResult } = AgoraRtcNg.CallApi(
      funcName,
      JSON.stringify(params),
      buffers,
      buffers.length
    );
    let ret = callApiResult;
    if (ret !== undefined && ret !== null && ret !== '') {
      const retObj = JSON.parse(ret);
      if (isDebuggable()) {
        if (typeof retObj.result === 'number' && retObj.result < 0) {
          logError('callApi', funcName, JSON.stringify(params), ret);
        } else {
          logDebug('callApi', funcName, JSON.stringify(params), ret);
        }
      }
      return retObj;
    } else {
      if (isDebuggable()) {
        logError(
          'callApi',
          funcName,
          JSON.stringify(params),
          callApiReturnCode
        );
      } else {
        logWarn('callApi', funcName, JSON.stringify(params), callApiReturnCode);
      }
      return { result: callApiReturnCode };
    }
  } catch (e) {
    if (isDebuggable()) {
      logError('callApi', funcName, JSON.stringify(params), e);
    } else {
      logWarn('callApi', funcName, JSON.stringify(params), e);
    }
  }
  return {};
}

/**
 * @internal
 */
export function emitEvent<EventType extends keyof T, T extends ProcessorType>(
  eventType: EventType,
  eventProcessor: EventProcessor<T>,
  data: any,
  buffers?: Uint8Array[]
): void {
  if (DeviceEventEmitter.listenerCount(eventType as string) === 0) {
    return;
  }
  if (eventProcessor.preprocess) {
    eventProcessor.preprocess(eventType as string, data, buffers ?? []);
    // call preprocess only once
    eventProcessor.preprocess = undefined;
  }
  DeviceEventEmitter.emit(eventType as string, eventProcessor, data);
}
