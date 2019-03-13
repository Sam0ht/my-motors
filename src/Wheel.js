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
    // direction = () => this.parent.pose.direction.clone();
    
    // up = () =>  this.parent.pose.up.clone();
    
    getRay = () => {
        const carPose = this.parent.pose;
        const longOffset = carPose.direction.clone().multiplyScalar(this.longOffset);
        const latOffset = this.parent.rightVector().multiplyScalar(this.latOffset);
        const origin = carPose.position.clone().add(longOffset).add(latOffset).add(carPose.up);
        const direction = carPose.up.clone().multiplyScalar(-1);
        return new THREE.Raycaster(origin, direction);
    }
    heightAboveGround = (meshes) => {
        const ray = this.getRay();
        const intersections = meshes.map(mesh => ray.intersectObject(mesh)).flat(2);
        return intersections.slice(0,1);  // first intersection or nothing
        // const distances = intersections.map(i => i.distance - 1);  // Ray starts from 1m above the 'wheel' position to avoid falling through
        // console.log(distances)
        return firstOr(1000)(distances);
    }
    // rightVector = () => this.direction().cross(this.up());
      
    angleFrom = (v1, v2, aroundAxis) => {
        const angle = v1.angleTo(v2);
        const cross = v1.clone().cross(v2);
        const polarity = Math.sign(aroundAxis.clone().dot(cross));
        return angle * polarity; // angleTo is absolute, doesn't include direction (sigh)
    }
    getForce = (meshes, steeringAngle, netAppliedTorque, time) => {

        const force = new THREE.Vector3(0, 0, 0);
        const maybeIntersection = this.heightAboveGround(meshes);
        
        //TODO duplication
        if (maybeIntersection.length === 0 || (maybeIntersection[0].distance - 1) > this.travel) {
            return force;  // wheel is not touching the ground so applies no forces
        }
        const {distance: d, face} =  maybeIntersection[0];
        const height = d - 1;

        const up = face.normal;  // normal of ground at contact point
        const direction = this.parent.pose.direction.clone().applyAxisAngle(up, steeringAngle);  // car heading plus any steering lock
        const right = direction.clone().cross(up); // should point along wheel 'axle'

        console.log(up, direction, right);
        
        const displacement = this.travel - height;        

        // spring + damper
        let verticalForce = displacement * this.springRate;
        if (this.lastDisplacement !== undefined && this.prevDisplacement !== undefined) {
            
            const oldDisplacement = (this.lastDisplacement + this.prevDisplacement) / 2
            const verticalWheelRate = (displacement - oldDisplacement) / time;
            const damperForce = this.damperRate * verticalWheelRate;
            verticalForce += damperForce;
        } 
        force.add(up.clone().multiplyScalar(verticalForce));
        this.prevDisplacement = this.lastDisplacement;
        this.lastDisplacement = displacement;
        

        // console.log("displacement", displacement, "springForce", springForce)

        // brake and acceleration
        const availableTraction = verticalForce * this.parent.tyreGrip;
        const longitudinalForce = Math.min(netAppliedTorque, availableTraction);
        force.add(direction.clone().multiplyScalar(longitudinalForce));

        // lateral

        const spinVelocity = -this.longOffset * this.parent.yawRate;
        const wheelVelocity = this.parent.velocity.clone().add(this.parent.rightVector().multiplyScalar(spinVelocity));
        const slipAngle = this.angleFrom(wheelVelocity, direction, up);
       
        const slipForce = slipAngle * wheelVelocity.length() * this.parent.tyreSharpness;
        const lateralForce = Math.min(slipForce, availableTraction);
        force.add(right.clone().multiplyScalar(-lateralForce));
        const wheelIsSlipping = slipForce > availableTraction;

        return force; 
    }
}
