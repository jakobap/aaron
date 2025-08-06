import { audioContext } from "./utils";
import AudioRecordingWorklet from "./worklets/audio-processing";
import VolMeterWorket from "./worklets/vol-meter";

import { createWorketFromSrc } from "./audioworklet-registry";
import EventEmitter from "eventemitter3";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export class AudioRecorder extends EventEmitter {
  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  private starting: Promise<void> | null = null;
  private streamCreatedInternally: boolean = false;

  constructor(public sampleRate = 16000) {
    super();
  }

  async start(stream?: MediaStream) {
    if (this.recording) {
      console.warn("Recording is already in progress.");
      return;
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        if (stream) {
          this.stream = stream;
          this.streamCreatedInternally = false;
        } else {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Could not request user media");
          }
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.streamCreatedInternally = true;
        }

        this.audioContext = await audioContext({ sampleRate: this.sampleRate });
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        const workletName = "audio-recorder-worklet";
        const src = createWorketFromSrc(workletName, AudioRecordingWorklet);

        await this.audioContext.audioWorklet.addModule(src);
        this.recordingWorklet = new AudioWorkletNode(
          this.audioContext,
          workletName,
        );

        this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
          const arrayBuffer = ev.data.data.int16arrayBuffer;
          if (arrayBuffer) {
            const arrayBufferString = arrayBufferToBase64(arrayBuffer);
            this.emit("data", arrayBufferString);
          }
        };
        this.source.connect(this.recordingWorklet);

        // vu meter worklet
        const vuWorkletName = "vu-meter";
        await this.audioContext.audioWorklet.addModule(
          createWorketFromSrc(vuWorkletName, VolMeterWorket),
        );
        this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
        this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
          this.emit("volume", ev.data.volume);
        };

        this.source.connect(this.vuWorklet);
        this.recording = true;
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        this.starting = null;
      }
    });
    return this.starting;
  }

  stop() {
    const handleStop = () => {
        this.recording = false;
        this.source?.disconnect();
        this.recordingWorklet?.port.close();
        this.recordingWorklet?.disconnect();
        this.vuWorklet?.port.close();
        this.vuWorklet?.disconnect();

        if (this.stream && this.streamCreatedInternally) {
            this.stream.getTracks().forEach((track) => track.stop());
        }

        this.stream = undefined;
        this.source = undefined;
        this.recordingWorklet = undefined;
        this.vuWorklet = undefined;
    };

    if (this.starting) {
        this.starting.then(handleStop).catch(handleStop);
    } else {
        handleStop();
    }
  }
}