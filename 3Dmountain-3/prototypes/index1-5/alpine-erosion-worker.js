import { erodeAlpineGrid, setAlpineDetailSnapshot } from './alpine-erosion.js';

self.onmessage = ({ data: { input, detail } }) => {
  try {
    setAlpineDetailSnapshot(detail);
    const steps = erodeAlpineGrid(input);
    let step = steps.next();
    while (!step.done) step = steps.next();
    const result = step.value;
    const buffers = Object.values(result).filter(ArrayBuffer.isView).map(array => array.buffer);
    self.postMessage({ result }, buffers);
  } catch {
    self.postMessage({ result: null });
  }
};
