(function (Scratch) {
  'use strict';

  // A simple Node class to store local transform data and (optionally) a target.
  class Node {
    constructor(target, id) {
      this.target = target; // the sprite/clone (a Scratch target)
      this.id = id;
      // Local transform values
      this.x = 0;
      this.y = 0;
      this.rotation = 0; // in degrees
      this.length = 1;   // multiplier (1 = 100%); now interpreted as the length/distance between this node and its parent only.
      // Parent node id (if any)
      this.parent = null;
    }
    // Recursively calculate the effective transform (parent transforms applied first)
    getEffectiveTransform(extension) {
      // Start with local values:
      let tx = this.x;
      let ty = this.y;
      let trot = this.rotation;
      let tlength = this.length;
      // If this node has a parent, get the parent’s effective transform and compose
      if (this.parent && extension.nodes[this.parent]) {
        const parentNode = extension.nodes[this.parent];
        const parentTrans = parentNode.getEffectiveTransform(extension);
        // Convert parent rotation to radians
        const rad = (parentTrans.trot - 90) * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        // First, scale the local position by the parent's effective length
        const newX = tx * parentTrans.tlength;
        const newY = ty * parentTrans.tlength;
        // Rotate the local position by the parent's rotation and add parent's position
        tx = parentTrans.tx + (newX * cos - newY * -sin);
        ty = parentTrans.ty + (newX * -sin + newY * cos);
        // The effective rotation is the sum of the parent's rotation and the local rotation
        trot = parentTrans.trot + trot;
        // Instead of compounding the scales, use the node's own length
        tlength = this.length;
      }
      return { tx, ty, trot, tlength };
    }
  }

  class TransformExtension {
    constructor(runtime) {
      this.runtime = runtime;
      // A dictionary mapping node IDs to Node instances.
      this.nodes = {};
    }

    // Block: assign node id [ID]
    assignNode(args, util) {
      const id = args.ID.toString();
      const target = util.target;
      if (!this.nodes[id]) {
        this.nodes[id] = new Node(target, id);
      } else {
        // Update the target reference if needed.
        this.nodes[id].target = target;
      }
    }

    // Block: node id [ID] set position to x: [X] y: [Y]
    setPosition(args, util) {
      const id = args.ID.toString();
      const x = Number(args.X);
      const y = Number(args.Y);
      if (!this.nodes[id]) {
        this.nodes[id] = new Node(util.target, id);
      }
      this.nodes[id].x = x;
      this.nodes[id].y = y;
      this.updateTransforms(this.nodes[id]);
    }

    // Block: node id [ID] set rotation to [ROT]
    setRotation(args, util) {
      const id = args.ID.toString();
      const rotation = Number(args.ROT);
      if (!this.nodes[id]) {
        this.nodes[id] = new Node(util.target, id);
      }
      this.nodes[id].rotation = rotation;
      this.updateTransforms(this.nodes[id]);
    }

    // Block: node id [ID] set length to [length]
    setlength(args, util) {
      const id = args.ID.toString();
      const length = Number(args.length);
      if (!this.nodes[id]) {
        this.nodes[id] = new Node(util.target, id);
      }
      this.nodes[id].length = length;
      this.updateTransforms(this.nodes[id]);
    }

    // Block: node id [ID] set parent to [PARENT_ID]
    setParent(args, util) {
      const childId = args.ID.toString();
      const parentId = args.PARENT_ID.toString();
      if (!this.nodes[childId]) {
        this.nodes[childId] = new Node(util.target, childId);
      }
      // Create a dummy parent if it doesn’t exist.
      if (!this.nodes[parentId]) {
        this.nodes[parentId] = new Node(null, parentId);
      }
      this.nodes[childId].parent = parentId;
      this.updateTransforms(this.nodes[childId]);
    }

    // Getter: node id [ID] effective x
    getEffectiveX(args, util) {
      const id = args.ID.toString();
      if (!this.nodes[id]) return 0;
      const effective = this.nodes[id].getEffectiveTransform(this);
      return effective.tx;
    }

    // Getter: node id [ID] effective y
    getEffectiveY(args, util) {
      const id = args.ID.toString();
      if (!this.nodes[id]) return 0;
      const effective = this.nodes[id].getEffectiveTransform(this);
      return effective.ty;
    }

    // Getter: node id [ID] effective rotation
    getEffectiveRotation(args, util) {
      const id = args.ID.toString();
      if (!this.nodes[id]) return 0;
      const effective = this.nodes[id].getEffectiveTransform(this);
      return effective.trot;
    }

    // Getter: node id [ID] effective length
    getEffectivelength(args, util) {
      const id = args.ID.toString();
      if (!this.nodes[id]) return 1;
      const effective = this.nodes[id].getEffectiveTransform(this);
      return effective.tlength;
    }

    // New FUNCTION: Return the parent id of a given node.
    getParent(args, util) {
      const id = args.ID.toString();
      if (!this.nodes[id]) return "";
      return this.nodes[id].parent || "";
    }

    // New FUNCTION: Return an array of node IDs that have the given node as their parent.
    getChildren(args, util) {
      const id = args.ID.toString();
      const children = [];
      for (const nodeId in this.nodes) {
        if (this.nodes[nodeId].parent === id) {
          children.push(nodeId);
        }
      }
      return children;
    }

    // When a node’s local transform changes, update its target’s properties and recursively update its children.
    updateTransforms(node) {
      const effective = node.getEffectiveTransform(this);
      if (node.target) {
        // In Scratch, x and y are the sprite’s coordinates,
        // 'direction' is its rotation, and 'size' is percentage (with 1 = 100%)
        node.target.setXY(effective.tx, effective.ty);
        node.target.setDirection(effective.trot);
      }
      // Recursively update any children nodes
      for (const id in this.nodes) {
        if (this.nodes[id].parent === node.id) {
          this.updateTransforms(this.nodes[id]);
        }
      }
    }

    // Existing function to break all relationships by clearing all nodes.
    clearAllNodes(args, util) {
      this.nodes = {};
    }

    // Define the extension’s blocks and menus.
    getInfo() {
      return {
        id: 'transform',
        name: 'Transform',
        blocks: [
          {
            opcode: 'assignNode',
            blockType: Scratch.BlockType.COMMAND,
            text: 'assign node id [ID]',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              }
            }
          },
          // New block: return the parent of a node
          {
            opcode: 'getParent',
            blockType: Scratch.BlockType.REPORTER,
            text: 'node id [ID] parent',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              }
            }
          },
          // New block: return an array of a node's children
          {
            opcode: 'getChildren',
            blockType: Scratch.BlockType.REPORTER,
            text: 'node id [ID] children',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              }
            }
          },
          {
            opcode: 'setPosition',
            blockType: Scratch.BlockType.COMMAND,
            text: 'node id [ID] set position to x: [X] y: [Y]',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              },
              X: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              },
              Y: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              }
            }
          },
          {
            opcode: 'setRotation',
            blockType: Scratch.BlockType.COMMAND,
            text: 'node id [ID] set rotation to [ROT]',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              },
              ROT: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              }
            }
          },
          {
            opcode: 'setlength',
            blockType: Scratch.BlockType.COMMAND,
            text: 'node id [ID] set length to [length]',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              },
              length: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 1
              }
            }
          },
          {
            opcode: 'setParent',
            blockType: Scratch.BlockType.COMMAND,
            text: 'node id [ID] set parent to [PARENT_ID]',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              },
              PARENT_ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'parent1'
              }
            }
          },
          {
            opcode: 'getEffectiveX',
            blockType: Scratch.BlockType.REPORTER,
            text: 'node id [ID] effective x',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              }
            }
          },
          {
            opcode: 'getEffectiveY',
            blockType: Scratch.BlockType.REPORTER,
            text: 'node id [ID] effective y',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              }
            }
          },
          {
            opcode: 'getEffectiveRotation',
            blockType: Scratch.BlockType.REPORTER,
            text: 'node id [ID] effective rotation',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              }
            }
          },
          {
            opcode: 'getEffectivelength',
            blockType: Scratch.BlockType.REPORTER,
            text: 'node id [ID] effective length',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'node1'
              }
            }
          },
          // New block to clear all nodes and break all relationships
          {
            opcode: 'clearAllNodes',
            blockType: Scratch.BlockType.COMMAND,
            text: 'clear all nodes and break all relationships'
          }
        ]
      };
    }
  }

  Scratch.extensions.register(new TransformExtension());
})(Scratch);
