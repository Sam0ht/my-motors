class Wheel {
    constructor(car, index, longOffset, latOffset, travel, springRate, damperRate) {
        this.parent = car;
        this.index = index;
        this.longOffset = longOffset;
        this.latOffset = latOffset;
        this.travel = travel;
        this.springRate = springRate * 10; // kg/m > N/m
        this.damperRate = damperRate;
    }
    direction = () => this.parent.pose.direction.clone();
    
    up = () =>  this.parent.pose.up.clone();
    
    getRay = () => {
        const longOffset = this.direction().multiplyScalar(this.longOffset);
        const latOffset = this.parent.rightVector().multiplyScalar(this.latOffset);
        const origin = this.parent.pose.position.clone().add(longOffset).add(latOffset).add(this.up());
        const direction = this.up().multiplyScalar(-1);
        return new THREE.Raycaster(origin, direction);
    }
    heightAboveGround = (meshes) => {
        const ray = this.getRay();
        const intersections = meshes.map(mesh => ray.intersectObject(mesh)).flat(2);
        const distances = intersections.map(i => i.distance - 1);  // Ray starts from 1m above the 'wheel' position to avoid falling through
        // console.log(distances)
        return firstOr(1000)(distances);
    }
    rightVector = () => this.direction().cross(this.up());
      
    angleFrom = (v1, v2) => {
        const angle = v1.angleTo(v2);
        const cross = v1.clone().cross(v2);
        const polarity = Math.sign(this.up().dot(cross));
        return angle * polarity; // angleTo is absolute, doesn't include direction (sigh)
    }
    getForce = (meshes, steeringAngle, netAppliedTorque, time) => {
        const force = new THREE.Vector3(0, 0, 0);
        const displacement = this.travel - this.heightAboveGround(meshes);        
        // console.log("d", displacement)
        if (displacement < 0) {
            return force;  // wheel is not touching the ground so applies no forces
        }

        const steerDirection = this.direction().applyAxisAngle(this.up(), steeringAngle);

        // spring + damper
        let verticalForce = displacement * this.springRate;
        if (this.lastDisplacement) {
            const verticalWheelRate = (displacement - this.lastDisplacement) / time;
            const damperForce = this.damperRate * verticalWheelRate;
            verticalForce += damperForce;
        } 
        force.add(this.up().multiplyScalar(verticalForce));
        this.lastDisplacement = displacement;
        

        // console.log("displacement", displacement, "springForce", springForce)

        // brake and acceleration
        const availableTraction = verticalForce * this.parent.tyreGrip;
        const longitudinalForce = Math.min(netAppliedTorque, availableTraction);
        // console.log("AT", availableTraction, "LongF", longitudinalForce)
        force.add(steerDirection.clone().multiplyScalar(longitudinalForce));

        // lateral

        const spinVelocity = -this.longOffset * this.parent.yawRate;
        const wheelVelocity = this.parent.velocity.clone().add(this.parent.rightVector().multiplyScalar(spinVelocity));
        const slipAngle = this.angleFrom(wheelVelocity, steerDirection);
       
        const slipForce = slipAngle * wheelVelocity.length() * this.parent.tyreSharpness;
        const lateralForce = Math.min(slipForce, availableTraction);
        force.add(this.rightVector().multiplyScalar(-lateralForce));
        const wheelIsSlipping = slipForce > availableTraction;

        return force; 
    }
}
