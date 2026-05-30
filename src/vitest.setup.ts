const canvasContextStub = {
  fillStyle: "",
  fillRect: () => undefined,
  putImageData: () => undefined,
  getImageData: () => ({
    data: new Uint8ClampedArray([0, 0, 0, 255])
  })
};

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: () => canvasContextStub
});
