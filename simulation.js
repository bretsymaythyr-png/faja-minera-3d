(function (root) {
  'use strict';
  // Datos de demostración: no se presentan como especificaciones de la mina estudiada.
  const C = Object.freeze({ length: 180, inclineDeg: 10, gravity: 9.81, maxSpeed: 2, minSpeed: 0.6, maxFlow: 2400, targetFill: 0.85, acceleration: 0.12, emptyKW: 150, loadKW: 400, nominalLoad: 60 });
  const targetSpeed = flow => Math.max(C.minSpeed, Math.min(C.maxSpeed, C.maxSpeed * Math.max(0, Math.min(C.maxFlow, flow)) / C.maxFlow / C.targetFill));
  class ConveyorSimulation {
    constructor(variable, initialFlow = 1200) { this.variable = variable; this.reset(initialFlow); }
    reset(flow = 1200) {
      this.speed = this.variable ? targetSpeed(flow) : C.maxSpeed;
      this.power = C.emptyKW * this.speed / C.maxSpeed;
      this.target = this.speed;
      this.incoming = 0; this.loaded = 0; this.discharged = 0; this.queue = 0;
      this.mass = 0; this.energy = 0; this.elapsed = 0; this.parcels = [];
    }
    step(dt, flow) {
      flow = Math.max(0, Math.min(C.maxFlow, Number(flow) || 0));
      dt = Math.max(0, Number(dt) || 0);
      this.target = this.variable ? targetSpeed(flow) : C.maxSpeed;
      const maxChange = C.acceleration * dt;
      this.speed += Math.max(-maxChange, Math.min(maxChange, this.target - this.speed));
      const arrival = flow * dt / 3600;
      this.incoming += arrival;
      this.queue += arrival;
      const capacity = C.maxFlow * (this.speed / C.maxSpeed) * dt / 3600;
      const admitted = Math.min(this.queue, capacity);
      this.queue = Math.max(0, this.queue - admitted);
      this.loaded += admitted;
      if (admitted > 0) { this.parcels.push({ distance: 0, mass: admitted }); this.mass += admitted; }
      const moved = this.speed * dt;
      let released = 0;
      for (const parcel of this.parcels) { parcel.distance += moved; }
      while (this.parcels.length && this.parcels[0].distance >= C.length) released += this.parcels.shift().mass;
      this.mass = Math.max(0, this.mass - released);
      this.discharged += released;
      // Modelo didáctico: resistencia aproximada y elevación ideal del material.
      const basePower = (C.emptyKW + C.loadKW * this.mass / C.nominalLoad) * this.speed / C.maxSpeed;
      const liftingPower = this.mass * C.gravity * Math.sin(C.inclineDeg * Math.PI / 180) * this.speed;
      this.power = basePower + liftingPower;
      this.energy += this.power * dt / 3600;
      this.elapsed += dt;
      return { admitted, released };
    }
  }
  const api = { ConveyorSimulation, constants: C, targetSpeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FajaPhysics = api;
})(typeof window !== 'undefined' ? window : globalThis);
