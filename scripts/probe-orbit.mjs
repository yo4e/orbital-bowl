const start = { x: -4.35, y: 0.45, z: -3.45 };
const length = (v) => Math.hypot(v.x, v.y, v.z);
const normalize = (v) => {
  const size = length(v);
  return { x: v.x / size, y: v.y / size, z: v.z / size };
};
const radial = normalize(start);
const tangent = normalize({ x: radial.z, y: 0, z: -radial.x });
let position = { ...start };
let velocity = { x: tangent.x * 4.76, y: 0, z: tangent.z * 4.76 };
const points = [];
for (let index = 0; index < 500; index += 1) {
  const distance = length(position);
  points.push({ index, distance, ...position });
  const normal = normalize(position);
  const acceleration = { x: normal.x * -145 / (distance * distance), y: normal.y * -145 / (distance * distance), z: normal.z * -145 / (distance * distance) };
  velocity = { x: velocity.x + acceleration.x / 52, y: velocity.y + acceleration.y / 52, z: velocity.z + acceleration.z / 52 };
  position = { x: position.x + velocity.x / 52, y: position.y + velocity.y / 52, z: position.z + velocity.z / 52 };
  if (distance < 4.24 || distance > 19) break;
}
console.log(JSON.stringify({ initialVelocity: velocity, sampled: points.filter((_, index) => index % 35 === 0), final: points.at(-1) }, null, 2));

const pinCenters = [];
for (const [row, count] of [1, 2, 3, 4].entries()) {
  for (let col = 0; col < count; col += 1) {
    pinCenters.push({ x: 3 + (col - (count - 1) / 2) * 0.47, y: -0.28 + 0.02 + row * 0.13 + 0.34, z: 3.05 + row * 0.38 });
  }
}
const nearest = pinCenters.map((pin, pinIndex) => ({
  pinIndex,
  distance: Math.min(...points.map((point) => Math.hypot(point.x - pin.x, point.y - pin.y, point.z - pin.z))),
}));
console.log(JSON.stringify({ nearest }, null, 2));
