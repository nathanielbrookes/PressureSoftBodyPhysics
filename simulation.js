var GY = 0.2; // Gravitational Constant
var ResistanceFactor = 0.95;

class Point {
    constructor(x, y) {
        // Set initial position, velocity and force acting on the point
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.force = createVector(1, 1); // Resultant Force
    }
}

class Spring {
    constructor(i, j, length) {
        this.i = i; // First Point Index
        this.j = j; // Second Point Index
        this.length = length; // Length of spring at rest
        this.normal = undefined; // Normal Vector
    }
}

class Simulation {
    constructor(x, y, settings) {
        this.settings = settings;
        
        this.newCollision = false;
        this.lastCollision = undefined;
        this.lastCollisionTime = undefined;
        
        this.mass = 10;
        this.NUMP = settings.nodeCount;
        this.radius = settings.nodeCount;

        this.fillColour = this.GetRandomColour();
        
        this.points = [];
        this.springs = [];
        this.averagePos = 0;

        this.CreateBody(x, y, this.radius);

        // Start Simulation Loop
        var t = this;
        setInterval(function() {
            t.Simulate(t.settings.animationSpeed / 100);
            t.IntegrateEuler(t.settings.animationSpeed / 100);
        }, 1000 / 100);

    }

    GetRandomColour() {
        colorMode(HSB, 100);
        return color(floor(random(0, 100)), 50, 75);
    }

    CreateBody(oX, oY, radius) {
        // Create Points
        for (var i = 1; i <= this.NUMP; i += 1) {
            let x = radius * sin(i * (2 * PI) / this.NUMP) + oX;
            let y = radius * cos(i * (2 * PI) / this.NUMP) + oY;
            
            this.points.push(new Point(x, y));
        }

        // Add Springs between Points
        for (var i = 0; i < this.NUMP; i += 1) {
            if (i == this.NUMP-1) {
                this.AddSpring(i, 0);
            }
            else {
                this.AddSpring(i, i+1);
            }
        }
    }

    AddSpring(i, j) {
        let v1 = this.points[i].pos;
        let v2 = this.points[j].pos;
        let dist = v1.dist(v2); // Calculates Euclidean Distance between points
        
        this.springs.push(new Spring(i, j, dist));
    }

    Simulate(DT) {
        // Simulate External Forces (gravity)
        for (var i = 0; i < this.points.length; i++) {
            let fx = 0;
            let fy = this.mass * GY;

            // Gravity can be 'switched off' in settings
            if (this.settings.gravity == false) {
                fy = 0;
            }
            
            this.points[i].force = createVector(fx, fy);
        }

        // Allow user to interact using the mouse:
        if (mouseIsPressed === true) {
            var mousePos = createVector(mouseX, mouseY);

            // 1) Find centre of body
            var averagePos = createVector(0,0);
            for (var i = 0; i < this.points.length; i++) {
                averagePos.add(this.points[i].pos);
            }
            this.averagePos = averagePos.div(this.points.length);

            // 2) Add small force to push points to their new location relative to the mouse
            for (var i = 0; i < this.points.length; i++) {
                var point = this.points[i];

                var vMovement = mousePos.copy().sub(averagePos);
                
                var mag = max(vMovement.mag(), 10);
                vMovement.normalize().mult(mag * 0.005);
                
                point.force.add(vMovement);
            }
        }

        // Simulate Spring Forces
        for (var i = 0; i < this.springs.length; i++) {
            // Get start and end points for each spring
            let p1 = this.points[this.springs[i].i];
            let p2 = this.points[this.springs[i].j];
            
            // Calculate Euclidean Distance between points
            let dist = p1.pos.dist(p2.pos); 

            // Calculate forces
            if (dist != 0) {
                // Get velocities of start and end points
                let vel = p1.vel.copy();
                vel.sub(p2.vel);

                // Calculate Force Value (Using Hooke's Law)
                let f = (dist - this.springs[i].length) * settings.springConstant + (vel.x * (p1.pos.x - p2.pos.x) + vel.y * (p1.pos.y - p2.pos.y)) * settings.springDamping / dist;
                let fx = ((p1.pos.x - p2.pos.x) / dist) * f;
                let fy = ((p1.pos.y - p2.pos.y) / dist) * f;
                let vForce = createVector(fx, fy);
                
                // Accumulate force for starting point
                p1.force.sub(vForce);

                // Accumulate force for end point
                p2.force.add(vForce);
            }

            // Calculate normal vectors to springs
            let nx = (p1.pos.y - p2.pos.y) / dist;
            let ny = -(p1.pos.x - p2.pos.x) / dist;

            this.springs[i].normal = createVector(nx, ny);

        }

        // Calculate Volume of the Ball (Gauss Theorem)
        let volume = 0;
        for (var i = 1; i < this.springs.length; i++) {
            // Get start and end points for each spring
            let p1 = this.points[this.springs[i].i];
            let p2 = this.points[this.springs[i].j];

            // Calculates Euclidean Distance between points
            let dist = p1.pos.dist(p2.pos); 

            volume += 0.5 * abs(p1.pos.x - p2.pos.x) * abs(this.springs[i].normal.x) * dist;
        }

        // Simulate Pressure
        for (var i = 0; i < this.springs.length; i++) {
            // Get start and end points for each spring
            let p1 = this.points[this.springs[i].i];
            let p2 = this.points[this.springs[i].j];

            // Calculates Euclidean Distance between points
            let dist = p1.pos.dist(p2.pos); 
            
            // Pressure Vector
            let vPressure = dist * settings.pressure * (1/volume);
            
            let v = this.springs[i].normal.copy();
            if (isNaN(vPressure)) {
                vPressure = 100;
            }

            v.mult(min(vPressure, 100));

            // Add Pressure Force to points
            p1.force.add(v);
            p2.force.add(v);
        }

    }

    IntegrateEuler(DT) {
        var dry;

        var collision = false;

        for (var i = 0; i < this.points.length; i++) {
            let point = this.points[i];
            
            point.force.mult(0.5);

            // Integrate X
            point.vel.x += (point.force.x / this.mass) * DT;
            point.pos.x += (point.vel.x * DT);

            // Integrate Y
            point.vel.y += (point.force.y / this.mass) * DT;
            dry = point.vel.y * DT;

            /* Resolve Horizontal Boundaries */
            if (point.pos.x > windowWidth) {
                point.vel.x = -point.vel.x * ResistanceFactor;
                collision = 'RIGHT';
            }
            else if (point.pos.x < 0) {
                point.vel.x = -point.vel.x * ResistanceFactor;
                collision = 'LEFT';
            }  
            
            /* Resolve Vertical Boundaries */
            if (point.pos.y + dry > windowHeight) {
                dry = windowHeight - point.pos.y;
                point.vel.y = -point.vel.y * ResistanceFactor;
                collision = 'BOTTOM';
            }
            else if (point.pos.y + dry < 0) {
                dry = - point.pos.y;
                point.vel.y = -point.vel.y * ResistanceFactor;
                collision = 'TOP';
            }                        
        
            point.pos.y += dry;

            // Restrict points within the bounds of the window
            point.pos.x = min(max(point.pos.x, 0), windowWidth);
            point.pos.y = min(max(point.pos.y, 0), windowHeight);
        }

        // Check if the ball has hit a different wall (used to change its colour)
        if (collision != false) {
            if (this.lastCollision !== collision) {
                this.lastCollision = collision;
                this.newCollision = true;
            }
        }
    }

    Draw() {
        // Changes the colour of the body if it hits a different wall (after 250ms)
        if (this.newCollision) {
            if (this.lastCollisionTime == undefined || Date.now() - this.lastCollisionTime > 250) {
                this.fillColour = this.GetRandomColour();
                this.lastCollisionTime = Date.now();
            }
            this.newCollision = false;
        }
        
        // Draws Soft Body
        noStroke();
        beginShape();
        for (var i = 0; i < this.points.length; i++) {
            var p1 = this.points[i];
            
            if (i < this.points.length - 1) {
                var p2 = this.points[i+1];

                vertex(p1.pos.x, p1.pos.y);
                vertex(p2.pos.x, p2.pos.y);
            }
            else {
                var p2 = this.points[0];

                vertex(p1.pos.x, p1.pos.y);
                vertex(p2.pos.x, p2.pos.y);
            }
        }
        endShape();
        fill(this.fillColour);

        // Draws a line between the body's centre pos and mouse pos (when the mouse is pressed)
        if (mouseIsPressed) {
            colorMode(RGB, 255);
            stroke(255);
            strokeWeight(5);
            line(this.averagePos.x, this.averagePos.y, mouseX, mouseY);
        }
    }
}