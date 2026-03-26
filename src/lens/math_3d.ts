// Minimal, zero-dependency 3D Math operations for WebGPU transforms.
// Specifically tailored to output Float32Arrays conforming strictly to mat4x4<f32>.

export type Mat4 = Float32Array;

export function createMat4(): Mat4 {
    const out = new Float32Array(16);
    out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
    return out;
}

export function vec4TransformMat4(out: Float32Array, v: Float32Array, m: Mat4) {
    const x = v[0], y = v[1], z = v[2], w = v[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
}

export function mat4Multiply(out: Mat4, a: Mat4, b: Mat4) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
}

export function mat4Perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number) {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0;
    out[10] = far / (near - far);
    out[11] = -1;
    out[12] = 0; out[13] = 0;
    out[14] = (near * far) / (near - far);
    out[15] = 0;
    return out;
}

export function mat4LookAt(out: Mat4, eyeX: number, eyeY: number, eyeZ: number,
                           centerX: number, centerY: number, centerZ: number,
                           upX: number, upY: number, upZ: number) {
    let z0 = eyeX - centerX;
    let z1 = eyeY - centerY;
    let z2 = eyeZ - centerZ;

    let len = z0 * z0 + z1 * z1 + z2 * z2;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        z0 *= len; z1 *= len; z2 *= len;
    }

    let x0 = upY * z2 - upZ * z1;
    let x1 = upZ * z0 - upX * z2;
    let x2 = upX * z1 - upY * z0;

    len = x0 * x0 + x1 * x1 + x2 * x2;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        x0 *= len; x1 *= len; x2 *= len;
    }

    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eyeX + x1 * eyeY + x2 * eyeZ);
    out[13] = -(y0 * eyeX + y1 * eyeY + y2 * eyeZ);
    out[14] = -(z0 * eyeX + z1 * eyeY + z2 * eyeZ);
    out[15] = 1;

    return out;
}

export class OrbitCamera {
    public pitch: number = 0;
    public yaw: number = 0;
    public distance: number = 2.5;

    public targetX: number = 0;
    public targetY: number = 0;
    public targetZ: number = 0;

    private _projMatrix: Mat4 = createMat4();
    private _viewMatrix: Mat4 = createMat4();
    private _mvpMatrix: Mat4 = createMat4();

    public updateMVP(aspectRatio: number): Mat4 {
        // Construct Projection (Perspective WebGPU uses Right-Handed coordinates)
        mat4Perspective(this._projMatrix, Math.PI / 4, aspectRatio, 0.1, 100.0);

        // Convert Euler angles to Cartesian camera position
        const cp = Math.cos(this.pitch);
        const sp = Math.sin(this.pitch);
        const cy = Math.cos(this.yaw);
        const sy = Math.sin(this.yaw);

        const eyeX = this.targetX + this.distance * cp * sy; // Y-up Orbit
        const eyeY = this.targetY + this.distance * sp;
        const eyeZ = this.targetZ + this.distance * cp * cy;

        // Construct View Matrix (LookAt)
        mat4LookAt(this._viewMatrix, 
            eyeX, eyeY, eyeZ, 
            this.targetX, this.targetY, this.targetZ, 
            0, 1, 0 // Up vector
        );

        // MVP = Proj * View
        mat4Multiply(this._mvpMatrix, this._projMatrix, this._viewMatrix);
        return this._mvpMatrix;
    }
}

// Era 267: Spatial Indexing & Frustum
export class Frustum {
    public planes: Float32Array[] = [];

    constructor() {
        for (let i = 0; i < 6; i++) {
            this.planes.push(new Float32Array(4));
        }
    }

    public update(vp: Mat4) {
        // Extract frustum planes from ViewProjection matrix
        // Left
        this.planes[0][0] = vp[3] + vp[0];
        this.planes[0][1] = vp[7] + vp[4];
        this.planes[0][2] = vp[11] + vp[8];
        this.planes[0][3] = vp[15] + vp[12];
        // Right
        this.planes[1][0] = vp[3] - vp[0];
        this.planes[1][1] = vp[7] - vp[4];
        this.planes[1][2] = vp[11] - vp[8];
        this.planes[1][3] = vp[15] - vp[12];
        // Bottom
        this.planes[2][0] = vp[3] + vp[1];
        this.planes[2][1] = vp[7] + vp[5];
        this.planes[2][2] = vp[11] + vp[9];
        this.planes[2][3] = vp[15] + vp[13];
        // Top
        this.planes[3][0] = vp[3] - vp[1];
        this.planes[3][1] = vp[7] - vp[5];
        this.planes[3][2] = vp[11] - vp[9];
        this.planes[3][3] = vp[15] - vp[13];
        // Near
        this.planes[4][0] = vp[3] + vp[2];
        this.planes[4][1] = vp[7] + vp[6];
        this.planes[4][2] = vp[11] + vp[10];
        this.planes[4][3] = vp[15] + vp[14];
        // Far
        this.planes[5][0] = vp[3] - vp[2];
        this.planes[5][1] = vp[7] - vp[6];
        this.planes[5][2] = vp[11] - vp[10];
        this.planes[5][3] = vp[15] - vp[14];

        for (let i = 0; i < 6; i++) {
            const p = this.planes[i];
            const mag = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
            if (mag > 0) {
                p[0] /= mag; p[1] /= mag; p[2] /= mag; p[3] /= mag;
            }
        }
    }

    // Sphere intersection
    public intersectsSphere(x: number, y: number, z: number, r: number): boolean {
        for (let i = 0; i < 6; i++) {
            const p = this.planes[i];
            const dist = p[0] * x + p[1] * y + p[2] * z + p[3];
            if (dist < -r) return false;
        }
        return true;
    }
}

// A node tracking a 2D Polar bounds bounded by Sector (θ) and Rho (r)
export class TorusQuadNode {
    public minSector: number;
    public maxSector: number;
    public minRho: number;
    public maxRho: number;
    public boundsX: number = 0;
    public boundsY: number = 0;
    public boundsZ: number = 0;
    public boundsRadius: number = 0;
    public children: TorusQuadNode[] = [];
    public leaf: boolean = true;

    constructor(minSector: number, maxSector: number, minRho: number, maxRho: number, totalSectors: number, totalRho: number) {
        this.minSector = minSector;
        this.maxSector = maxSector;
        this.minRho = minRho;
        this.maxRho = maxRho;

        // Calculate 3D sphere bounds for this Torus quad
        const midSector = (minSector + maxSector) / 2;
        const midRho = (minRho + maxRho) / 2;
        
        const angle = (midSector / totalSectors) * Math.PI * 2;
        const radius_t = (midRho + 1) / (totalRho + 1);
        const major_radius = 2.8 * radius_t;
        
        this.boundsX = Math.cos(angle) * major_radius;
        this.boundsY = Math.sin(angle) * major_radius;
        this.boundsZ = 0.0; // Torus depth center
        
        // Approximate spanning radius
        const spanSectors = ((maxSector - minSector) / totalSectors) * Math.PI * 2 * major_radius;
        const spanRho = ((maxRho - minRho) / totalRho) * 2.8;
        this.boundsRadius = Math.max(spanSectors, spanRho) * 1.5 + 0.6; // + 0.6 for harmonic Z-depth bounds
    }

    public subdivide(totalSectors: number, totalRho: number) {
        if (this.maxSector - this.minSector <= 16 || this.maxRho - this.minRho <= 16) return;
        this.leaf = false;
        const midS = Math.floor((this.minSector + this.maxSector) / 2);
        const midR = Math.floor((this.minRho + this.maxRho) / 2);
        
        this.children.push(new TorusQuadNode(this.minSector, midS, this.minRho, midR, totalSectors, totalRho));
        this.children.push(new TorusQuadNode(midS, this.maxSector, this.minRho, midR, totalSectors, totalRho));
        this.children.push(new TorusQuadNode(this.minSector, midS, midR, this.maxRho, totalSectors, totalRho));
        this.children.push(new TorusQuadNode(midS, this.maxSector, midR, this.maxRho, totalSectors, totalRho));
        
        for(const child of this.children) child.subdivide(totalSectors, totalRho);
    }
}

export class TorusQuadtree {
    public root: TorusQuadNode;
    public totalSectors: number;
    public totalRho: number;
    
    constructor(sectors: number, radial_bins: number) {
        this.totalSectors = sectors;
        this.totalRho = radial_bins;
        this.root = new TorusQuadNode(0, sectors, 0, radial_bins, sectors, radial_bins);
        this.root.subdivide(sectors, radial_bins);
    }
    
    public getVisibleLeaves(frustum: Frustum): TorusQuadNode[] {
        const visible: TorusQuadNode[] = [];
        const traverse = (node: TorusQuadNode) => {
            if (!frustum.intersectsSphere(node.boundsX, node.boundsY, node.boundsZ, node.boundsRadius)) {
                return;
            }
            if (node.leaf) {
                visible.push(node);
            } else {
                for(const child of node.children) traverse(child);
            }
        };
        traverse(this.root);
        return visible;
    }
}
