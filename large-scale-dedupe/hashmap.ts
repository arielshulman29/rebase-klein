const hashed = Symbol('hashed');
type Hashed = number & { __brand: typeof hashed }
function hashString(str: string, size: number): Hashed {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash * size + char) >>> 0;
    }
    return hash as Hashed;
}

function reHash(hash: Hashed): Hashed {
    return hash << 1 as Hashed;
}

class HashNode {
    value: Hashed;
    next: HashNode | null;
    parent: HashNode | null;

    constructor(value: Hashed, parent: HashNode | null) {
        this.value = value;
        this.next = null;
        this.parent = parent;
    }

    setNext(node: HashNode) {
        this.next = node;
    }

    setParent(node: HashNode | null) {
        this.parent = node;
    }
}

class LinkedHashList {
    private head: HashNode | null;
    private tail: HashNode | null;
    private count: number;
    constructor() {
        this.head = null;
        this.tail = null;
        this.count = 0;
    }
    clear() {
        this.head = null;
        this.tail = null;
        this.count = 0;
    }
    add(value: Hashed) {
        if (this.head) {
            const node = new HashNode(value, this.tail);
            if (this.tail) {
                this.tail.setNext(node);
            }
            this.tail = node;
            this.count++;
        } else {
            this.head = new HashNode(value, null);
            this.tail = this.head;
            this.count++;
        }
    }
    getCount() {
        return this.count;
    }
    getHead() {
        return this.head;
    }
    getTail() {
        return this.tail;
    }
    isInBucket(value: Hashed) {
        for (const node of this) {
            if (node.value === value) {
                return true;
            }
        }
        return false;
    }
    *[Symbol.iterator]() {
        let current = this.head;
        while (current) {
            yield current;
            current = current.next;
        }
    }
}

export class HashSet {
    size: number;
    private buckets: Array<LinkedHashList>;
    private count: number;

    constructor(size = 8) {
        this.size = size;
        this.buckets = new Array(size).fill(null).map(() => new LinkedHashList());
        this.count = 0;
    }

    private duplicateBucketSize() {
        this.size <<= 1;
        const oldBuckets = [...this.buckets];
        this.buckets = new Array(this.size).fill(null).map(() => new LinkedHashList());
        for (let oldBucketIndex = 0; oldBucketIndex < oldBuckets.length; oldBucketIndex++) {
            const oldBucket = oldBuckets[oldBucketIndex];
            for (const node of oldBucket) {
                this.addHash(node.value);
                node.setParent(null);
                this.count++;
            }
            oldBucket.clear();
        }
    }

    private hash(key: string) {
        const hashed = hashString(key, this.size);
        return [hashed, hashed % this.size] as [Hashed, number];
    }

    private reHash(hash: Hashed) {
        const hashed = reHash(hash);
        return [hashed, hashed % this.size] as [Hashed, number];
    }

    add(value: string): void {
        const [hash, index] = this.hash(value);
        const bucket = this.buckets[index];
        bucket.add(hash);
        this.count++;
    }

    private addHash(hash: Hashed): void {
        const [newHash, index] = this.reHash(hash);
        const bucket = this.buckets[index];
        bucket.add(newHash);
        this.count++;
    }

    has(value: string): boolean {
        const [hash, index] = this.hash(value);
        const bucket = this.buckets[index];
        return bucket.isInBucket(hash);
    }
}
