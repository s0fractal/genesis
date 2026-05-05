const genome = 805483090;
const flags = 164;
const species = (flags >> 1) & 0x7F;
console.log("Species:", species);

const n_e = [1045, 881, 1001, 1058, 601, 383];
let ed = 0;
for (let e of n_e) {
    ed += Math.trunc((e - 250) / 8);
}
console.log("Energy Diffusion:", ed);
