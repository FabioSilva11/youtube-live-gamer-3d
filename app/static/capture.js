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
