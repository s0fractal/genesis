/// <reference lib="webworker" />

self.onmessage = (e: MessageEvent) => {
    const { 
        oldTheta, oldOmega, oldPlasmids,
        oldSectors, oldRadial, oldHarm,
        tSectors, tRadial, tHarm
    } = e.data;

    const newCount = tSectors * tRadial * tHarm;
    const newTheta = new Uint8Array(newCount);
    const newOmega = new Int16Array(newCount);
    const newPlasmids = new BigUint64Array(newCount);

    for (let h = 0; h < tHarm; h++) {
        const oldH = Math.min(h, oldHarm - 1);
        for (let r = 0; r < tRadial; r++) {
            const ratioR = r / tRadial;
            const oldR = Math.min(Math.floor(ratioR * oldRadial), oldRadial - 1);
            for (let s = 0; s < tSectors; s++) {
                const ratioS = s / tSectors;
                const oldS = Math.min(Math.floor(ratioS * oldSectors), oldSectors - 1);
                
                const oldIdx = oldH * oldRadial * oldSectors + oldR * oldSectors + oldS;
                const newIdx = h * tRadial * tSectors + r * tSectors + s;
                
                newTheta[newIdx] = oldTheta[oldIdx];
                newOmega[newIdx] = oldOmega[oldIdx];
                newPlasmids[newIdx] = oldPlasmids[oldIdx];
            }
        }
    }

    // O-57: Return interpolated matrices directly to the Main Thread via Zero-Copy Transfer
    self.postMessage({
        newTheta, newOmega, newPlasmids
    }, {
        transfer: [newTheta.buffer, newOmega.buffer, newPlasmids.buffer]
    });
};
