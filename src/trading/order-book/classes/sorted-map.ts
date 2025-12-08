export enum Color {
  RED,
  BLACK,
}

export class Node<K, V> {
  key: K;
  value: V;
  left: Node<K, V> | null = null;
  right: Node<K, V> | null = null;
  parent: Node<K, V> | null = null;
  color: Color = Color.RED;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

export class SortedMap<K, V> {
  private root: Node<K, V> | null = null;
  private compare: (a: K, b: K) => number;

  constructor(compareFn?: (a: K, b: K) => number) {
    this.compare =
      compareFn || ((a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0));
  }

  public set(key: K, value: V): void {
    let node = this.root;
    let parent: Node<K, V> | null = null;

    while (node !== null) {
      parent = node;
      const cmp = this.compare(key, node.key);
      if (cmp < 0) {
        node = node.left;
      } else if (cmp > 0) {
        node = node.right;
      } else {
        node.value = value;
        return;
      }
    }

    const newNode = new Node(key, value);
    newNode.parent = parent;

    if (parent === null) {
      this.root = newNode;
    } else {
      const cmp = this.compare(key, parent.key);
      if (cmp < 0) {
        parent.left = newNode;
      } else {
        parent.right = newNode;
      }
    }

    this.fixInsert(newNode);
  }

  public get(key: K): V | undefined {
    let node = this.root;
    while (node !== null) {
      const cmp = this.compare(key, node.key);
      if (cmp < 0) {
        node = node.left;
      } else if (cmp > 0) {
        node = node.right;
      } else {
        return node.value;
      }
    }
    return undefined;
  }

  public delete(key: K): boolean {
    let node = this.root;
    while (node !== null) {
      const cmp = this.compare(key, node.key);
      if (cmp < 0) {
        node = node.left;
      } else if (cmp > 0) {
        node = node.right;
      } else {
        break;
      }
    }

    if (node === null) return false;

    this.deleteNode(node);
    return true;
  }

  public *iterator(): IterableIterator<{ key: K; value: V }> {
    yield* this.inOrderTraversal(this.root);
  }

  private *inOrderTraversal(
    node: Node<K, V> | null,
  ): IterableIterator<{ key: K; value: V }> {
    if (node !== null) {
      yield* this.inOrderTraversal(node.left);
      yield { key: node.key, value: node.value };
      yield* this.inOrderTraversal(node.right);
    }
  }

  private fixInsert(node: Node<K, V>): void {
    while (node.parent !== null && node.parent.color === Color.RED) {
      let uncle: Node<K, V> | null = null;
      const grandParent = node.parent.parent;

      if (node.parent === grandParent!.left) {
        uncle = grandParent!.right;

        if (uncle !== null && uncle.color === Color.RED) {
          node.parent.color = Color.BLACK;
          uncle.color = Color.BLACK;
          grandParent!.color = Color.RED;
          node = grandParent!;
        } else {
          if (node === node.parent.right) {
            node = node.parent;
            this.rotateLeft(node);
          }
          node.parent!.color = Color.BLACK;
          grandParent!.color = Color.RED;
          this.rotateRight(grandParent!);
        }
      } else {
        uncle = grandParent!.left;

        if (uncle !== null && uncle.color === Color.RED) {
          node.parent.color = Color.BLACK;
          uncle.color = Color.BLACK;
          grandParent!.color = Color.RED;
          node = grandParent!;
        } else {
          if (node === node.parent.left) {
            node = node.parent;
            this.rotateRight(node);
          }
          node.parent!.color = Color.BLACK;
          grandParent!.color = Color.RED;
          this.rotateLeft(grandParent!);
        }
      }
    }
    this.root!.color = Color.BLACK;
  }

  private rotateLeft(node: Node<K, V>): void {
    const rightChild = node.right!;
    node.right = rightChild.left;

    if (rightChild.left !== null) {
      rightChild.left.parent = node;
    }

    rightChild.parent = node.parent;

    if (node.parent === null) {
      this.root = rightChild;
    } else if (node === node.parent.left) {
      node.parent.left = rightChild;
    } else {
      node.parent.right = rightChild;
    }

    rightChild.left = node;
    node.parent = rightChild;
  }

  private rotateRight(node: Node<K, V>): void {
    const leftChild = node.left!;
    node.left = leftChild.right;

    if (leftChild.right !== null) {
      leftChild.right.parent = node;
    }

    leftChild.parent = node.parent;

    if (node.parent === null) {
      this.root = leftChild;
    } else if (node === node.parent.right) {
      node.parent.right = leftChild;
    } else {
      node.parent.left = leftChild;
    }

    leftChild.right = node;
    node.parent = leftChild;
  }

  private deleteNode(node: Node<K, V>): void {
    let splice: Node<K, V>;
    let child: Node<K, V> | null;

    if (node.left === null || node.right === null) {
      splice = node;
    } else {
      splice = node.right;
      while (splice.left !== null) {
        splice = splice.left;
      }
    }

    if (splice.left !== null) {
      child = splice.left;
    } else {
      child = splice.right;
    }

    if (child !== null) {
      child.parent = splice.parent;
    }

    if (splice.parent === null) {
      this.root = child;
    } else if (splice === splice.parent.left) {
      splice.parent.left = child;
    } else {
      splice.parent.right = child;
    }

    if (splice !== node) {
      node.key = splice.key;
      node.value = splice.value;
    }

    if (splice.color === Color.BLACK && child !== null) {
      this.fixDelete(child);
    }
  }

  private fixDelete(node: Node<K, V>): void {
    while (node !== this.root && node.color === Color.BLACK) {
      if (node === node.parent!.left) {
        let sibling = node.parent!.right!;
        if (sibling.color === Color.RED) {
          sibling.color = Color.BLACK;
          node.parent!.color = Color.RED;
          this.rotateLeft(node.parent!);
          sibling = node.parent!.right!;
        }

        if (
          (sibling.left === null || sibling.left.color === Color.BLACK) &&
          (sibling.right === null || sibling.right.color === Color.BLACK)
        ) {
          sibling.color = Color.RED;
          node = node.parent!;
        } else {
          if (sibling.right === null || sibling.right.color === Color.BLACK) {
            if (sibling.left !== null) sibling.left.color = Color.BLACK;
            sibling.color = Color.RED;
            this.rotateRight(sibling);
            sibling = node.parent!.right!;
          }
          sibling.color = node.parent!.color;
          node.parent!.color = Color.BLACK;
          if (sibling.right !== null) sibling.right.color = Color.BLACK;
          this.rotateLeft(node.parent!);
          node = this.root!;
        }
      } else {
        let sibling = node.parent!.left!;
        if (sibling.color === Color.RED) {
          sibling.color = Color.BLACK;
          node.parent!.color = Color.RED;
          this.rotateRight(node.parent!);
          sibling = node.parent!.left!;
        }

        if (
          (sibling.right === null || sibling.right.color === Color.BLACK) &&
          (sibling.left === null || sibling.left.color === Color.BLACK)
        ) {
          sibling.color = Color.RED;
          node = node.parent!;
        } else {
          if (sibling.left === null || sibling.left.color === Color.BLACK) {
            if (sibling.right !== null) sibling.right.color = Color.BLACK;
            sibling.color = Color.RED;
            this.rotateLeft(sibling);
            sibling = node.parent!.left!;
          }
          sibling.color = node.parent!.color;
          node.parent!.color = Color.BLACK;
          if (sibling.left !== null) sibling.left.color = Color.BLACK;
          this.rotateRight(node.parent!);
          node = this.root!;
        }
      }
    }
    node.color = Color.BLACK;
  }
}
