export function captureSessionIsActive(generation, currentGeneration, socket, currentSocket) {
  return generation === currentGeneration
    && socket === currentSocket
    && socket?.readyState === 1;
}

export function stopMediaTracks(stream) {
  if (!stream?.getTracks) return 0;
  const tracks = stream.getTracks();
  tracks.forEach((track) => track.stop());
  return tracks.length;
}

export async function playMusicPlayback(audio) {
  audio.loop = true;
  await audio.play();
}

export async function startMusicForLive(audio) {
  audio.currentTime = 0;
  await playMusicPlayback(audio);
}

export function pauseMusicPlayback(audio) {
  audio.pause();
}

export function stopMusicForLive(audio) {
  pauseMusicPlayback(audio);
  audio.currentTime = 0;
}

export function createMusicCaptureRoute(context, audio, volume) {
  const source = context.createMediaElementSource(audio);
  const gain = context.createGain();
  const destination = context.createMediaStreamDestination();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(context.destination);
  gain.connect(destination);
  return {
    context,
    gain,
    track: destination.stream.getAudioTracks()[0],
    detachCaptureTrack() { gain.disconnect(destination); },
  };
}
