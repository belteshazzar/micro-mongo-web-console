
import Airplane from 'https://raw.githubusercontent.com/belteshazzar/micro-mongo-web-console/refs/heads/belteshazzar/dev/examples/airplane.js'
import Indirect from 'https://raw.githubusercontent.com/belteshazzar/micro-mongo-web-console/refs/heads/belteshazzar/dev/examples/indirect.js'
import Chained from 'https://raw.githubusercontent.com/belteshazzar/micro-mongo-web-console/refs/heads/belteshazzar/dev/examples/chained.js'

Airplane.availableAirplanes.forEach( a => {
  console.log(a.name + " " + a.fuelCapacity);
})

function x() {
  return 4;
}
console.log(x());

console.log(Airplane);
console.log(Indirect);
console.log(Chained);

function main() {
  return new Promise( resolve => {
    console.log(3);
    resolve(4);
    console.log(5);
  });
}

async function f(){
  console.log(2);
  let r = await main();
  console.log(r);
}

console.log(1);
f();
console.log(6);
