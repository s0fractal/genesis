/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.omega_v2 = (function() {

    /**
     * Namespace omega_v2.
     * @exports omega_v2
     * @namespace
     */
    var omega_v2 = {};

    omega_v2.PhaseAgentMinimal = (function() {

        /**
         * Properties of a PhaseAgentMinimal.
         * @memberof omega_v2
         * @interface IPhaseAgentMinimal
         * @property {number|null} [phase] PhaseAgentMinimal phase
         * @property {number|null} [energy] PhaseAgentMinimal energy
         * @property {number|null} [baseFreq] PhaseAgentMinimal baseFreq
         * @property {number|null} [stateFlags] PhaseAgentMinimal stateFlags
         * @property {number|null} [genome] PhaseAgentMinimal genome
         * @property {Array.<number>|null} [memory] PhaseAgentMinimal memory
         */

        /**
         * Constructs a new PhaseAgentMinimal.
         * @memberof omega_v2
         * @classdesc Represents a PhaseAgentMinimal.
         * @implements IPhaseAgentMinimal
         * @constructor
         * @param {omega_v2.IPhaseAgentMinimal=} [properties] Properties to set
         */
        function PhaseAgentMinimal(properties) {
            this.memory = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PhaseAgentMinimal phase.
         * @member {number} phase
         * @memberof omega_v2.PhaseAgentMinimal
         * @instance
         */
        PhaseAgentMinimal.prototype.phase = 0;

        /**
         * PhaseAgentMinimal energy.
         * @member {number} energy
         * @memberof omega_v2.PhaseAgentMinimal
         * @instance
         */
        PhaseAgentMinimal.prototype.energy = 0;

        /**
         * PhaseAgentMinimal baseFreq.
         * @member {number} baseFreq
         * @memberof omega_v2.PhaseAgentMinimal
         * @instance
         */
        PhaseAgentMinimal.prototype.baseFreq = 0;

        /**
         * PhaseAgentMinimal stateFlags.
         * @member {number} stateFlags
         * @memberof omega_v2.PhaseAgentMinimal
         * @instance
         */
        PhaseAgentMinimal.prototype.stateFlags = 0;

        /**
         * PhaseAgentMinimal genome.
         * @member {number} genome
         * @memberof omega_v2.PhaseAgentMinimal
         * @instance
         */
        PhaseAgentMinimal.prototype.genome = 0;

        /**
         * PhaseAgentMinimal memory.
         * @member {Array.<number>} memory
         * @memberof omega_v2.PhaseAgentMinimal
         * @instance
         */
        PhaseAgentMinimal.prototype.memory = $util.emptyArray;

        /**
         * Creates a new PhaseAgentMinimal instance using the specified properties.
         * @function create
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {omega_v2.IPhaseAgentMinimal=} [properties] Properties to set
         * @returns {omega_v2.PhaseAgentMinimal} PhaseAgentMinimal instance
         */
        PhaseAgentMinimal.create = function create(properties) {
            return new PhaseAgentMinimal(properties);
        };

        /**
         * Encodes the specified PhaseAgentMinimal message. Does not implicitly {@link omega_v2.PhaseAgentMinimal.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {omega_v2.IPhaseAgentMinimal} message PhaseAgentMinimal message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PhaseAgentMinimal.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.phase != null && Object.hasOwnProperty.call(message, "phase"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.phase);
            if (message.energy != null && Object.hasOwnProperty.call(message, "energy"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.energy);
            if (message.baseFreq != null && Object.hasOwnProperty.call(message, "baseFreq"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.baseFreq);
            if (message.stateFlags != null && Object.hasOwnProperty.call(message, "stateFlags"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.stateFlags);
            if (message.genome != null && Object.hasOwnProperty.call(message, "genome"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.genome);
            if (message.memory != null && message.memory.length) {
                writer.uint32(/* id 6, wireType 2 =*/50).fork();
                for (var i = 0; i < message.memory.length; ++i)
                    writer.uint32(message.memory[i]);
                writer.ldelim();
            }
            return writer;
        };

        /**
         * Encodes the specified PhaseAgentMinimal message, length delimited. Does not implicitly {@link omega_v2.PhaseAgentMinimal.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {omega_v2.IPhaseAgentMinimal} message PhaseAgentMinimal message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PhaseAgentMinimal.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PhaseAgentMinimal message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.PhaseAgentMinimal} PhaseAgentMinimal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PhaseAgentMinimal.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.PhaseAgentMinimal();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.phase = reader.uint32();
                        break;
                    }
                case 2: {
                        message.energy = reader.uint32();
                        break;
                    }
                case 3: {
                        message.baseFreq = reader.int32();
                        break;
                    }
                case 4: {
                        message.stateFlags = reader.uint32();
                        break;
                    }
                case 5: {
                        message.genome = reader.uint32();
                        break;
                    }
                case 6: {
                        if (!(message.memory && message.memory.length))
                            message.memory = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.memory.push(reader.uint32());
                        } else
                            message.memory.push(reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a PhaseAgentMinimal message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.PhaseAgentMinimal} PhaseAgentMinimal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PhaseAgentMinimal.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PhaseAgentMinimal message.
         * @function verify
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PhaseAgentMinimal.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.phase != null && message.hasOwnProperty("phase"))
                if (!$util.isInteger(message.phase))
                    return "phase: integer expected";
            if (message.energy != null && message.hasOwnProperty("energy"))
                if (!$util.isInteger(message.energy))
                    return "energy: integer expected";
            if (message.baseFreq != null && message.hasOwnProperty("baseFreq"))
                if (!$util.isInteger(message.baseFreq))
                    return "baseFreq: integer expected";
            if (message.stateFlags != null && message.hasOwnProperty("stateFlags"))
                if (!$util.isInteger(message.stateFlags))
                    return "stateFlags: integer expected";
            if (message.genome != null && message.hasOwnProperty("genome"))
                if (!$util.isInteger(message.genome))
                    return "genome: integer expected";
            if (message.memory != null && message.hasOwnProperty("memory")) {
                if (!Array.isArray(message.memory))
                    return "memory: array expected";
                for (var i = 0; i < message.memory.length; ++i)
                    if (!$util.isInteger(message.memory[i]))
                        return "memory: integer[] expected";
            }
            return null;
        };

        /**
         * Creates a PhaseAgentMinimal message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.PhaseAgentMinimal} PhaseAgentMinimal
         */
        PhaseAgentMinimal.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.PhaseAgentMinimal)
                return object;
            var message = new $root.omega_v2.PhaseAgentMinimal();
            if (object.phase != null)
                message.phase = object.phase >>> 0;
            if (object.energy != null)
                message.energy = object.energy >>> 0;
            if (object.baseFreq != null)
                message.baseFreq = object.baseFreq | 0;
            if (object.stateFlags != null)
                message.stateFlags = object.stateFlags >>> 0;
            if (object.genome != null)
                message.genome = object.genome >>> 0;
            if (object.memory) {
                if (!Array.isArray(object.memory))
                    throw TypeError(".omega_v2.PhaseAgentMinimal.memory: array expected");
                message.memory = [];
                for (var i = 0; i < object.memory.length; ++i)
                    message.memory[i] = object.memory[i] >>> 0;
            }
            return message;
        };

        /**
         * Creates a plain object from a PhaseAgentMinimal message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {omega_v2.PhaseAgentMinimal} message PhaseAgentMinimal
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PhaseAgentMinimal.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.memory = [];
            if (options.defaults) {
                object.phase = 0;
                object.energy = 0;
                object.baseFreq = 0;
                object.stateFlags = 0;
                object.genome = 0;
            }
            if (message.phase != null && message.hasOwnProperty("phase"))
                object.phase = message.phase;
            if (message.energy != null && message.hasOwnProperty("energy"))
                object.energy = message.energy;
            if (message.baseFreq != null && message.hasOwnProperty("baseFreq"))
                object.baseFreq = message.baseFreq;
            if (message.stateFlags != null && message.hasOwnProperty("stateFlags"))
                object.stateFlags = message.stateFlags;
            if (message.genome != null && message.hasOwnProperty("genome"))
                object.genome = message.genome;
            if (message.memory && message.memory.length) {
                object.memory = [];
                for (var j = 0; j < message.memory.length; ++j)
                    object.memory[j] = message.memory[j];
            }
            return object;
        };

        /**
         * Converts this PhaseAgentMinimal to JSON.
         * @function toJSON
         * @memberof omega_v2.PhaseAgentMinimal
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PhaseAgentMinimal.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PhaseAgentMinimal
         * @function getTypeUrl
         * @memberof omega_v2.PhaseAgentMinimal
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PhaseAgentMinimal.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.PhaseAgentMinimal";
        };

        return PhaseAgentMinimal;
    })();

    omega_v2.AttractorMatrix = (function() {

        /**
         * Properties of an AttractorMatrix.
         * @memberof omega_v2
         * @interface IAttractorMatrix
         * @property {number|null} [state] AttractorMatrix state
         */

        /**
         * Constructs a new AttractorMatrix.
         * @memberof omega_v2
         * @classdesc Represents an AttractorMatrix.
         * @implements IAttractorMatrix
         * @constructor
         * @param {omega_v2.IAttractorMatrix=} [properties] Properties to set
         */
        function AttractorMatrix(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AttractorMatrix state.
         * @member {number} state
         * @memberof omega_v2.AttractorMatrix
         * @instance
         */
        AttractorMatrix.prototype.state = 0;

        /**
         * Creates a new AttractorMatrix instance using the specified properties.
         * @function create
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {omega_v2.IAttractorMatrix=} [properties] Properties to set
         * @returns {omega_v2.AttractorMatrix} AttractorMatrix instance
         */
        AttractorMatrix.create = function create(properties) {
            return new AttractorMatrix(properties);
        };

        /**
         * Encodes the specified AttractorMatrix message. Does not implicitly {@link omega_v2.AttractorMatrix.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {omega_v2.IAttractorMatrix} message AttractorMatrix message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AttractorMatrix.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.state != null && Object.hasOwnProperty.call(message, "state"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.state);
            return writer;
        };

        /**
         * Encodes the specified AttractorMatrix message, length delimited. Does not implicitly {@link omega_v2.AttractorMatrix.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {omega_v2.IAttractorMatrix} message AttractorMatrix message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AttractorMatrix.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an AttractorMatrix message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.AttractorMatrix} AttractorMatrix
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AttractorMatrix.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.AttractorMatrix();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.state = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an AttractorMatrix message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.AttractorMatrix} AttractorMatrix
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AttractorMatrix.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an AttractorMatrix message.
         * @function verify
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        AttractorMatrix.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.state != null && message.hasOwnProperty("state"))
                if (!$util.isInteger(message.state))
                    return "state: integer expected";
            return null;
        };

        /**
         * Creates an AttractorMatrix message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.AttractorMatrix} AttractorMatrix
         */
        AttractorMatrix.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.AttractorMatrix)
                return object;
            var message = new $root.omega_v2.AttractorMatrix();
            if (object.state != null)
                message.state = object.state >>> 0;
            return message;
        };

        /**
         * Creates a plain object from an AttractorMatrix message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {omega_v2.AttractorMatrix} message AttractorMatrix
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AttractorMatrix.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.state = 0;
            if (message.state != null && message.hasOwnProperty("state"))
                object.state = message.state;
            return object;
        };

        /**
         * Converts this AttractorMatrix to JSON.
         * @function toJSON
         * @memberof omega_v2.AttractorMatrix
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AttractorMatrix.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for AttractorMatrix
         * @function getTypeUrl
         * @memberof omega_v2.AttractorMatrix
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        AttractorMatrix.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.AttractorMatrix";
        };

        return AttractorMatrix;
    })();

    omega_v2.AttractorArray = (function() {

        /**
         * Properties of an AttractorArray.
         * @memberof omega_v2
         * @interface IAttractorArray
         * @property {number|null} [count] AttractorArray count
         * @property {Array.<number>|null} [_pad] AttractorArray _pad
         * @property {Array.<omega_v2.IAttractorMatrix>|null} [data] AttractorArray data
         */

        /**
         * Constructs a new AttractorArray.
         * @memberof omega_v2
         * @classdesc Represents an AttractorArray.
         * @implements IAttractorArray
         * @constructor
         * @param {omega_v2.IAttractorArray=} [properties] Properties to set
         */
        function AttractorArray(properties) {
            this._pad = [];
            this.data = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AttractorArray count.
         * @member {number} count
         * @memberof omega_v2.AttractorArray
         * @instance
         */
        AttractorArray.prototype.count = 0;

        /**
         * AttractorArray _pad.
         * @member {Array.<number>} _pad
         * @memberof omega_v2.AttractorArray
         * @instance
         */
        AttractorArray.prototype._pad = $util.emptyArray;

        /**
         * AttractorArray data.
         * @member {Array.<omega_v2.IAttractorMatrix>} data
         * @memberof omega_v2.AttractorArray
         * @instance
         */
        AttractorArray.prototype.data = $util.emptyArray;

        /**
         * Creates a new AttractorArray instance using the specified properties.
         * @function create
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {omega_v2.IAttractorArray=} [properties] Properties to set
         * @returns {omega_v2.AttractorArray} AttractorArray instance
         */
        AttractorArray.create = function create(properties) {
            return new AttractorArray(properties);
        };

        /**
         * Encodes the specified AttractorArray message. Does not implicitly {@link omega_v2.AttractorArray.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {omega_v2.IAttractorArray} message AttractorArray message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AttractorArray.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.count != null && Object.hasOwnProperty.call(message, "count"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.count);
            if (message._pad != null && message._pad.length) {
                writer.uint32(/* id 2, wireType 2 =*/18).fork();
                for (var i = 0; i < message._pad.length; ++i)
                    writer.uint32(message._pad[i]);
                writer.ldelim();
            }
            if (message.data != null && message.data.length)
                for (var i = 0; i < message.data.length; ++i)
                    $root.omega_v2.AttractorMatrix.encode(message.data[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified AttractorArray message, length delimited. Does not implicitly {@link omega_v2.AttractorArray.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {omega_v2.IAttractorArray} message AttractorArray message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AttractorArray.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an AttractorArray message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.AttractorArray} AttractorArray
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AttractorArray.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.AttractorArray();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.count = reader.uint32();
                        break;
                    }
                case 2: {
                        if (!(message._pad && message._pad.length))
                            message._pad = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message._pad.push(reader.uint32());
                        } else
                            message._pad.push(reader.uint32());
                        break;
                    }
                case 3: {
                        if (!(message.data && message.data.length))
                            message.data = [];
                        message.data.push($root.omega_v2.AttractorMatrix.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an AttractorArray message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.AttractorArray} AttractorArray
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AttractorArray.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an AttractorArray message.
         * @function verify
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        AttractorArray.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.count != null && message.hasOwnProperty("count"))
                if (!$util.isInteger(message.count))
                    return "count: integer expected";
            if (message._pad != null && message.hasOwnProperty("_pad")) {
                if (!Array.isArray(message._pad))
                    return "_pad: array expected";
                for (var i = 0; i < message._pad.length; ++i)
                    if (!$util.isInteger(message._pad[i]))
                        return "_pad: integer[] expected";
            }
            if (message.data != null && message.hasOwnProperty("data")) {
                if (!Array.isArray(message.data))
                    return "data: array expected";
                for (var i = 0; i < message.data.length; ++i) {
                    var error = $root.omega_v2.AttractorMatrix.verify(message.data[i]);
                    if (error)
                        return "data." + error;
                }
            }
            return null;
        };

        /**
         * Creates an AttractorArray message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.AttractorArray} AttractorArray
         */
        AttractorArray.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.AttractorArray)
                return object;
            var message = new $root.omega_v2.AttractorArray();
            if (object.count != null)
                message.count = object.count >>> 0;
            if (object._pad) {
                if (!Array.isArray(object._pad))
                    throw TypeError(".omega_v2.AttractorArray._pad: array expected");
                message._pad = [];
                for (var i = 0; i < object._pad.length; ++i)
                    message._pad[i] = object._pad[i] >>> 0;
            }
            if (object.data) {
                if (!Array.isArray(object.data))
                    throw TypeError(".omega_v2.AttractorArray.data: array expected");
                message.data = [];
                for (var i = 0; i < object.data.length; ++i) {
                    if (typeof object.data[i] !== "object")
                        throw TypeError(".omega_v2.AttractorArray.data: object expected");
                    message.data[i] = $root.omega_v2.AttractorMatrix.fromObject(object.data[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from an AttractorArray message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {omega_v2.AttractorArray} message AttractorArray
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AttractorArray.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object._pad = [];
                object.data = [];
            }
            if (options.defaults)
                object.count = 0;
            if (message.count != null && message.hasOwnProperty("count"))
                object.count = message.count;
            if (message._pad && message._pad.length) {
                object._pad = [];
                for (var j = 0; j < message._pad.length; ++j)
                    object._pad[j] = message._pad[j];
            }
            if (message.data && message.data.length) {
                object.data = [];
                for (var j = 0; j < message.data.length; ++j)
                    object.data[j] = $root.omega_v2.AttractorMatrix.toObject(message.data[j], options);
            }
            return object;
        };

        /**
         * Converts this AttractorArray to JSON.
         * @function toJSON
         * @memberof omega_v2.AttractorArray
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AttractorArray.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for AttractorArray
         * @function getTypeUrl
         * @memberof omega_v2.AttractorArray
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        AttractorArray.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.AttractorArray";
        };

        return AttractorArray;
    })();

    omega_v2.SignalStore = (function() {

        /**
         * Properties of a SignalStore.
         * @memberof omega_v2
         * @interface ISignalStore
         * @property {number|null} [dirtyFlags] SignalStore dirtyFlags
         * @property {number|null} [absoluteTick] SignalStore absoluteTick
         * @property {number|null} [activeAgentCount] SignalStore activeAgentCount
         * @property {number|null} [maxCells] SignalStore maxCells
         */

        /**
         * Constructs a new SignalStore.
         * @memberof omega_v2
         * @classdesc Represents a SignalStore.
         * @implements ISignalStore
         * @constructor
         * @param {omega_v2.ISignalStore=} [properties] Properties to set
         */
        function SignalStore(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SignalStore dirtyFlags.
         * @member {number} dirtyFlags
         * @memberof omega_v2.SignalStore
         * @instance
         */
        SignalStore.prototype.dirtyFlags = 0;

        /**
         * SignalStore absoluteTick.
         * @member {number} absoluteTick
         * @memberof omega_v2.SignalStore
         * @instance
         */
        SignalStore.prototype.absoluteTick = 0;

        /**
         * SignalStore activeAgentCount.
         * @member {number} activeAgentCount
         * @memberof omega_v2.SignalStore
         * @instance
         */
        SignalStore.prototype.activeAgentCount = 0;

        /**
         * SignalStore maxCells.
         * @member {number} maxCells
         * @memberof omega_v2.SignalStore
         * @instance
         */
        SignalStore.prototype.maxCells = 0;

        /**
         * Creates a new SignalStore instance using the specified properties.
         * @function create
         * @memberof omega_v2.SignalStore
         * @static
         * @param {omega_v2.ISignalStore=} [properties] Properties to set
         * @returns {omega_v2.SignalStore} SignalStore instance
         */
        SignalStore.create = function create(properties) {
            return new SignalStore(properties);
        };

        /**
         * Encodes the specified SignalStore message. Does not implicitly {@link omega_v2.SignalStore.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.SignalStore
         * @static
         * @param {omega_v2.ISignalStore} message SignalStore message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SignalStore.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.dirtyFlags != null && Object.hasOwnProperty.call(message, "dirtyFlags"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.dirtyFlags);
            if (message.absoluteTick != null && Object.hasOwnProperty.call(message, "absoluteTick"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.absoluteTick);
            if (message.activeAgentCount != null && Object.hasOwnProperty.call(message, "activeAgentCount"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.activeAgentCount);
            if (message.maxCells != null && Object.hasOwnProperty.call(message, "maxCells"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.maxCells);
            return writer;
        };

        /**
         * Encodes the specified SignalStore message, length delimited. Does not implicitly {@link omega_v2.SignalStore.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.SignalStore
         * @static
         * @param {omega_v2.ISignalStore} message SignalStore message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SignalStore.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SignalStore message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.SignalStore
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.SignalStore} SignalStore
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SignalStore.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.SignalStore();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.dirtyFlags = reader.uint32();
                        break;
                    }
                case 2: {
                        message.absoluteTick = reader.uint32();
                        break;
                    }
                case 3: {
                        message.activeAgentCount = reader.uint32();
                        break;
                    }
                case 4: {
                        message.maxCells = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SignalStore message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.SignalStore
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.SignalStore} SignalStore
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SignalStore.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SignalStore message.
         * @function verify
         * @memberof omega_v2.SignalStore
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SignalStore.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.dirtyFlags != null && message.hasOwnProperty("dirtyFlags"))
                if (!$util.isInteger(message.dirtyFlags))
                    return "dirtyFlags: integer expected";
            if (message.absoluteTick != null && message.hasOwnProperty("absoluteTick"))
                if (!$util.isInteger(message.absoluteTick))
                    return "absoluteTick: integer expected";
            if (message.activeAgentCount != null && message.hasOwnProperty("activeAgentCount"))
                if (!$util.isInteger(message.activeAgentCount))
                    return "activeAgentCount: integer expected";
            if (message.maxCells != null && message.hasOwnProperty("maxCells"))
                if (!$util.isInteger(message.maxCells))
                    return "maxCells: integer expected";
            return null;
        };

        /**
         * Creates a SignalStore message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.SignalStore
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.SignalStore} SignalStore
         */
        SignalStore.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.SignalStore)
                return object;
            var message = new $root.omega_v2.SignalStore();
            if (object.dirtyFlags != null)
                message.dirtyFlags = object.dirtyFlags >>> 0;
            if (object.absoluteTick != null)
                message.absoluteTick = object.absoluteTick >>> 0;
            if (object.activeAgentCount != null)
                message.activeAgentCount = object.activeAgentCount >>> 0;
            if (object.maxCells != null)
                message.maxCells = object.maxCells >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a SignalStore message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.SignalStore
         * @static
         * @param {omega_v2.SignalStore} message SignalStore
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SignalStore.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.dirtyFlags = 0;
                object.absoluteTick = 0;
                object.activeAgentCount = 0;
                object.maxCells = 0;
            }
            if (message.dirtyFlags != null && message.hasOwnProperty("dirtyFlags"))
                object.dirtyFlags = message.dirtyFlags;
            if (message.absoluteTick != null && message.hasOwnProperty("absoluteTick"))
                object.absoluteTick = message.absoluteTick;
            if (message.activeAgentCount != null && message.hasOwnProperty("activeAgentCount"))
                object.activeAgentCount = message.activeAgentCount;
            if (message.maxCells != null && message.hasOwnProperty("maxCells"))
                object.maxCells = message.maxCells;
            return object;
        };

        /**
         * Converts this SignalStore to JSON.
         * @function toJSON
         * @memberof omega_v2.SignalStore
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SignalStore.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SignalStore
         * @function getTypeUrl
         * @memberof omega_v2.SignalStore
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SignalStore.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.SignalStore";
        };

        return SignalStore;
    })();

    omega_v2.SporeFrame = (function() {

        /**
         * Properties of a SporeFrame.
         * @memberof omega_v2
         * @interface ISporeFrame
         * @property {number|null} [magic] SporeFrame magic
         * @property {number|null} [frameType] SporeFrame frameType
         * @property {number|null} [ttl] SporeFrame ttl
         * @property {Uint8Array|null} [payload] SporeFrame payload
         * @property {number|null} [crc] SporeFrame crc
         */

        /**
         * Constructs a new SporeFrame.
         * @memberof omega_v2
         * @classdesc Represents a SporeFrame.
         * @implements ISporeFrame
         * @constructor
         * @param {omega_v2.ISporeFrame=} [properties] Properties to set
         */
        function SporeFrame(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SporeFrame magic.
         * @member {number} magic
         * @memberof omega_v2.SporeFrame
         * @instance
         */
        SporeFrame.prototype.magic = 0;

        /**
         * SporeFrame frameType.
         * @member {number} frameType
         * @memberof omega_v2.SporeFrame
         * @instance
         */
        SporeFrame.prototype.frameType = 0;

        /**
         * SporeFrame ttl.
         * @member {number} ttl
         * @memberof omega_v2.SporeFrame
         * @instance
         */
        SporeFrame.prototype.ttl = 0;

        /**
         * SporeFrame payload.
         * @member {Uint8Array} payload
         * @memberof omega_v2.SporeFrame
         * @instance
         */
        SporeFrame.prototype.payload = $util.newBuffer([]);

        /**
         * SporeFrame crc.
         * @member {number} crc
         * @memberof omega_v2.SporeFrame
         * @instance
         */
        SporeFrame.prototype.crc = 0;

        /**
         * Creates a new SporeFrame instance using the specified properties.
         * @function create
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {omega_v2.ISporeFrame=} [properties] Properties to set
         * @returns {omega_v2.SporeFrame} SporeFrame instance
         */
        SporeFrame.create = function create(properties) {
            return new SporeFrame(properties);
        };

        /**
         * Encodes the specified SporeFrame message. Does not implicitly {@link omega_v2.SporeFrame.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {omega_v2.ISporeFrame} message SporeFrame message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SporeFrame.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.magic != null && Object.hasOwnProperty.call(message, "magic"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.magic);
            if (message.frameType != null && Object.hasOwnProperty.call(message, "frameType"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.frameType);
            if (message.ttl != null && Object.hasOwnProperty.call(message, "ttl"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.ttl);
            if (message.payload != null && Object.hasOwnProperty.call(message, "payload"))
                writer.uint32(/* id 4, wireType 2 =*/34).bytes(message.payload);
            if (message.crc != null && Object.hasOwnProperty.call(message, "crc"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.crc);
            return writer;
        };

        /**
         * Encodes the specified SporeFrame message, length delimited. Does not implicitly {@link omega_v2.SporeFrame.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {omega_v2.ISporeFrame} message SporeFrame message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SporeFrame.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SporeFrame message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.SporeFrame} SporeFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SporeFrame.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.SporeFrame();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.magic = reader.uint32();
                        break;
                    }
                case 2: {
                        message.frameType = reader.uint32();
                        break;
                    }
                case 3: {
                        message.ttl = reader.uint32();
                        break;
                    }
                case 4: {
                        message.payload = reader.bytes();
                        break;
                    }
                case 5: {
                        message.crc = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SporeFrame message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.SporeFrame} SporeFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SporeFrame.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SporeFrame message.
         * @function verify
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SporeFrame.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.magic != null && message.hasOwnProperty("magic"))
                if (!$util.isInteger(message.magic))
                    return "magic: integer expected";
            if (message.frameType != null && message.hasOwnProperty("frameType"))
                if (!$util.isInteger(message.frameType))
                    return "frameType: integer expected";
            if (message.ttl != null && message.hasOwnProperty("ttl"))
                if (!$util.isInteger(message.ttl))
                    return "ttl: integer expected";
            if (message.payload != null && message.hasOwnProperty("payload"))
                if (!(message.payload && typeof message.payload.length === "number" || $util.isString(message.payload)))
                    return "payload: buffer expected";
            if (message.crc != null && message.hasOwnProperty("crc"))
                if (!$util.isInteger(message.crc))
                    return "crc: integer expected";
            return null;
        };

        /**
         * Creates a SporeFrame message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.SporeFrame} SporeFrame
         */
        SporeFrame.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.SporeFrame)
                return object;
            var message = new $root.omega_v2.SporeFrame();
            if (object.magic != null)
                message.magic = object.magic >>> 0;
            if (object.frameType != null)
                message.frameType = object.frameType >>> 0;
            if (object.ttl != null)
                message.ttl = object.ttl >>> 0;
            if (object.payload != null)
                if (typeof object.payload === "string")
                    $util.base64.decode(object.payload, message.payload = $util.newBuffer($util.base64.length(object.payload)), 0);
                else if (object.payload.length >= 0)
                    message.payload = object.payload;
            if (object.crc != null)
                message.crc = object.crc >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a SporeFrame message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {omega_v2.SporeFrame} message SporeFrame
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SporeFrame.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.magic = 0;
                object.frameType = 0;
                object.ttl = 0;
                if (options.bytes === String)
                    object.payload = "";
                else {
                    object.payload = [];
                    if (options.bytes !== Array)
                        object.payload = $util.newBuffer(object.payload);
                }
                object.crc = 0;
            }
            if (message.magic != null && message.hasOwnProperty("magic"))
                object.magic = message.magic;
            if (message.frameType != null && message.hasOwnProperty("frameType"))
                object.frameType = message.frameType;
            if (message.ttl != null && message.hasOwnProperty("ttl"))
                object.ttl = message.ttl;
            if (message.payload != null && message.hasOwnProperty("payload"))
                object.payload = options.bytes === String ? $util.base64.encode(message.payload, 0, message.payload.length) : options.bytes === Array ? Array.prototype.slice.call(message.payload) : message.payload;
            if (message.crc != null && message.hasOwnProperty("crc"))
                object.crc = message.crc;
            return object;
        };

        /**
         * Converts this SporeFrame to JSON.
         * @function toJSON
         * @memberof omega_v2.SporeFrame
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SporeFrame.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SporeFrame
         * @function getTypeUrl
         * @memberof omega_v2.SporeFrame
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SporeFrame.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.SporeFrame";
        };

        return SporeFrame;
    })();

    omega_v2.ZKProofBundle = (function() {

        /**
         * Properties of a ZKProofBundle.
         * @memberof omega_v2
         * @interface IZKProofBundle
         * @property {string|null} [kind] ZKProofBundle kind
         * @property {string|null} [receiptHash] ZKProofBundle receiptHash
         * @property {number|null} [parentGenome] ZKProofBundle parentGenome
         * @property {boolean|null} [verified] ZKProofBundle verified
         * @property {Uint8Array|null} [proofBytes] ZKProofBundle proofBytes
         * @property {Uint8Array|null} [publicValues] ZKProofBundle publicValues
         * @property {string|null} [note] ZKProofBundle note
         */

        /**
         * Constructs a new ZKProofBundle.
         * @memberof omega_v2
         * @classdesc Represents a ZKProofBundle.
         * @implements IZKProofBundle
         * @constructor
         * @param {omega_v2.IZKProofBundle=} [properties] Properties to set
         */
        function ZKProofBundle(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ZKProofBundle kind.
         * @member {string} kind
         * @memberof omega_v2.ZKProofBundle
         * @instance
         */
        ZKProofBundle.prototype.kind = "";

        /**
         * ZKProofBundle receiptHash.
         * @member {string} receiptHash
         * @memberof omega_v2.ZKProofBundle
         * @instance
         */
        ZKProofBundle.prototype.receiptHash = "";

        /**
         * ZKProofBundle parentGenome.
         * @member {number} parentGenome
         * @memberof omega_v2.ZKProofBundle
         * @instance
         */
        ZKProofBundle.prototype.parentGenome = 0;

        /**
         * ZKProofBundle verified.
         * @member {boolean} verified
         * @memberof omega_v2.ZKProofBundle
         * @instance
         */
        ZKProofBundle.prototype.verified = false;

        /**
         * ZKProofBundle proofBytes.
         * @member {Uint8Array} proofBytes
         * @memberof omega_v2.ZKProofBundle
         * @instance
         */
        ZKProofBundle.prototype.proofBytes = $util.newBuffer([]);

        /**
         * ZKProofBundle publicValues.
         * @member {Uint8Array} publicValues
         * @memberof omega_v2.ZKProofBundle
         * @instance
         */
        ZKProofBundle.prototype.publicValues = $util.newBuffer([]);

        /**
         * ZKProofBundle note.
         * @member {string} note
         * @memberof omega_v2.ZKProofBundle
         * @instance
         */
        ZKProofBundle.prototype.note = "";

        /**
         * Creates a new ZKProofBundle instance using the specified properties.
         * @function create
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {omega_v2.IZKProofBundle=} [properties] Properties to set
         * @returns {omega_v2.ZKProofBundle} ZKProofBundle instance
         */
        ZKProofBundle.create = function create(properties) {
            return new ZKProofBundle(properties);
        };

        /**
         * Encodes the specified ZKProofBundle message. Does not implicitly {@link omega_v2.ZKProofBundle.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {omega_v2.IZKProofBundle} message ZKProofBundle message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ZKProofBundle.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.kind != null && Object.hasOwnProperty.call(message, "kind"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.kind);
            if (message.receiptHash != null && Object.hasOwnProperty.call(message, "receiptHash"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.receiptHash);
            if (message.parentGenome != null && Object.hasOwnProperty.call(message, "parentGenome"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.parentGenome);
            if (message.verified != null && Object.hasOwnProperty.call(message, "verified"))
                writer.uint32(/* id 4, wireType 0 =*/32).bool(message.verified);
            if (message.proofBytes != null && Object.hasOwnProperty.call(message, "proofBytes"))
                writer.uint32(/* id 5, wireType 2 =*/42).bytes(message.proofBytes);
            if (message.publicValues != null && Object.hasOwnProperty.call(message, "publicValues"))
                writer.uint32(/* id 6, wireType 2 =*/50).bytes(message.publicValues);
            if (message.note != null && Object.hasOwnProperty.call(message, "note"))
                writer.uint32(/* id 7, wireType 2 =*/58).string(message.note);
            return writer;
        };

        /**
         * Encodes the specified ZKProofBundle message, length delimited. Does not implicitly {@link omega_v2.ZKProofBundle.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {omega_v2.IZKProofBundle} message ZKProofBundle message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ZKProofBundle.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ZKProofBundle message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.ZKProofBundle} ZKProofBundle
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ZKProofBundle.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.ZKProofBundle();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.kind = reader.string();
                        break;
                    }
                case 2: {
                        message.receiptHash = reader.string();
                        break;
                    }
                case 3: {
                        message.parentGenome = reader.uint32();
                        break;
                    }
                case 4: {
                        message.verified = reader.bool();
                        break;
                    }
                case 5: {
                        message.proofBytes = reader.bytes();
                        break;
                    }
                case 6: {
                        message.publicValues = reader.bytes();
                        break;
                    }
                case 7: {
                        message.note = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ZKProofBundle message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.ZKProofBundle} ZKProofBundle
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ZKProofBundle.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ZKProofBundle message.
         * @function verify
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ZKProofBundle.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.kind != null && message.hasOwnProperty("kind"))
                if (!$util.isString(message.kind))
                    return "kind: string expected";
            if (message.receiptHash != null && message.hasOwnProperty("receiptHash"))
                if (!$util.isString(message.receiptHash))
                    return "receiptHash: string expected";
            if (message.parentGenome != null && message.hasOwnProperty("parentGenome"))
                if (!$util.isInteger(message.parentGenome))
                    return "parentGenome: integer expected";
            if (message.verified != null && message.hasOwnProperty("verified"))
                if (typeof message.verified !== "boolean")
                    return "verified: boolean expected";
            if (message.proofBytes != null && message.hasOwnProperty("proofBytes"))
                if (!(message.proofBytes && typeof message.proofBytes.length === "number" || $util.isString(message.proofBytes)))
                    return "proofBytes: buffer expected";
            if (message.publicValues != null && message.hasOwnProperty("publicValues"))
                if (!(message.publicValues && typeof message.publicValues.length === "number" || $util.isString(message.publicValues)))
                    return "publicValues: buffer expected";
            if (message.note != null && message.hasOwnProperty("note"))
                if (!$util.isString(message.note))
                    return "note: string expected";
            return null;
        };

        /**
         * Creates a ZKProofBundle message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.ZKProofBundle} ZKProofBundle
         */
        ZKProofBundle.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.ZKProofBundle)
                return object;
            var message = new $root.omega_v2.ZKProofBundle();
            if (object.kind != null)
                message.kind = String(object.kind);
            if (object.receiptHash != null)
                message.receiptHash = String(object.receiptHash);
            if (object.parentGenome != null)
                message.parentGenome = object.parentGenome >>> 0;
            if (object.verified != null)
                message.verified = Boolean(object.verified);
            if (object.proofBytes != null)
                if (typeof object.proofBytes === "string")
                    $util.base64.decode(object.proofBytes, message.proofBytes = $util.newBuffer($util.base64.length(object.proofBytes)), 0);
                else if (object.proofBytes.length >= 0)
                    message.proofBytes = object.proofBytes;
            if (object.publicValues != null)
                if (typeof object.publicValues === "string")
                    $util.base64.decode(object.publicValues, message.publicValues = $util.newBuffer($util.base64.length(object.publicValues)), 0);
                else if (object.publicValues.length >= 0)
                    message.publicValues = object.publicValues;
            if (object.note != null)
                message.note = String(object.note);
            return message;
        };

        /**
         * Creates a plain object from a ZKProofBundle message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {omega_v2.ZKProofBundle} message ZKProofBundle
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ZKProofBundle.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.kind = "";
                object.receiptHash = "";
                object.parentGenome = 0;
                object.verified = false;
                if (options.bytes === String)
                    object.proofBytes = "";
                else {
                    object.proofBytes = [];
                    if (options.bytes !== Array)
                        object.proofBytes = $util.newBuffer(object.proofBytes);
                }
                if (options.bytes === String)
                    object.publicValues = "";
                else {
                    object.publicValues = [];
                    if (options.bytes !== Array)
                        object.publicValues = $util.newBuffer(object.publicValues);
                }
                object.note = "";
            }
            if (message.kind != null && message.hasOwnProperty("kind"))
                object.kind = message.kind;
            if (message.receiptHash != null && message.hasOwnProperty("receiptHash"))
                object.receiptHash = message.receiptHash;
            if (message.parentGenome != null && message.hasOwnProperty("parentGenome"))
                object.parentGenome = message.parentGenome;
            if (message.verified != null && message.hasOwnProperty("verified"))
                object.verified = message.verified;
            if (message.proofBytes != null && message.hasOwnProperty("proofBytes"))
                object.proofBytes = options.bytes === String ? $util.base64.encode(message.proofBytes, 0, message.proofBytes.length) : options.bytes === Array ? Array.prototype.slice.call(message.proofBytes) : message.proofBytes;
            if (message.publicValues != null && message.hasOwnProperty("publicValues"))
                object.publicValues = options.bytes === String ? $util.base64.encode(message.publicValues, 0, message.publicValues.length) : options.bytes === Array ? Array.prototype.slice.call(message.publicValues) : message.publicValues;
            if (message.note != null && message.hasOwnProperty("note"))
                object.note = message.note;
            return object;
        };

        /**
         * Converts this ZKProofBundle to JSON.
         * @function toJSON
         * @memberof omega_v2.ZKProofBundle
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ZKProofBundle.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ZKProofBundle
         * @function getTypeUrl
         * @memberof omega_v2.ZKProofBundle
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ZKProofBundle.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.ZKProofBundle";
        };

        return ZKProofBundle;
    })();

    omega_v2.TickRollupReceipt = (function() {

        /**
         * Properties of a TickRollupReceipt.
         * @memberof omega_v2
         * @interface ITickRollupReceipt
         * @property {string|null} [initialHash] TickRollupReceipt initialHash
         * @property {string|null} [finalHash] TickRollupReceipt finalHash
         * @property {omega_v2.IZKProofBundle|null} [proof] TickRollupReceipt proof
         */

        /**
         * Constructs a new TickRollupReceipt.
         * @memberof omega_v2
         * @classdesc Represents a TickRollupReceipt.
         * @implements ITickRollupReceipt
         * @constructor
         * @param {omega_v2.ITickRollupReceipt=} [properties] Properties to set
         */
        function TickRollupReceipt(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * TickRollupReceipt initialHash.
         * @member {string} initialHash
         * @memberof omega_v2.TickRollupReceipt
         * @instance
         */
        TickRollupReceipt.prototype.initialHash = "";

        /**
         * TickRollupReceipt finalHash.
         * @member {string} finalHash
         * @memberof omega_v2.TickRollupReceipt
         * @instance
         */
        TickRollupReceipt.prototype.finalHash = "";

        /**
         * TickRollupReceipt proof.
         * @member {omega_v2.IZKProofBundle|null|undefined} proof
         * @memberof omega_v2.TickRollupReceipt
         * @instance
         */
        TickRollupReceipt.prototype.proof = null;

        /**
         * Creates a new TickRollupReceipt instance using the specified properties.
         * @function create
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {omega_v2.ITickRollupReceipt=} [properties] Properties to set
         * @returns {omega_v2.TickRollupReceipt} TickRollupReceipt instance
         */
        TickRollupReceipt.create = function create(properties) {
            return new TickRollupReceipt(properties);
        };

        /**
         * Encodes the specified TickRollupReceipt message. Does not implicitly {@link omega_v2.TickRollupReceipt.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {omega_v2.ITickRollupReceipt} message TickRollupReceipt message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TickRollupReceipt.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.initialHash != null && Object.hasOwnProperty.call(message, "initialHash"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.initialHash);
            if (message.finalHash != null && Object.hasOwnProperty.call(message, "finalHash"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.finalHash);
            if (message.proof != null && Object.hasOwnProperty.call(message, "proof"))
                $root.omega_v2.ZKProofBundle.encode(message.proof, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified TickRollupReceipt message, length delimited. Does not implicitly {@link omega_v2.TickRollupReceipt.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {omega_v2.ITickRollupReceipt} message TickRollupReceipt message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TickRollupReceipt.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a TickRollupReceipt message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.TickRollupReceipt} TickRollupReceipt
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TickRollupReceipt.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.TickRollupReceipt();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.initialHash = reader.string();
                        break;
                    }
                case 2: {
                        message.finalHash = reader.string();
                        break;
                    }
                case 3: {
                        message.proof = $root.omega_v2.ZKProofBundle.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a TickRollupReceipt message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.TickRollupReceipt} TickRollupReceipt
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TickRollupReceipt.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a TickRollupReceipt message.
         * @function verify
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        TickRollupReceipt.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.initialHash != null && message.hasOwnProperty("initialHash"))
                if (!$util.isString(message.initialHash))
                    return "initialHash: string expected";
            if (message.finalHash != null && message.hasOwnProperty("finalHash"))
                if (!$util.isString(message.finalHash))
                    return "finalHash: string expected";
            if (message.proof != null && message.hasOwnProperty("proof")) {
                var error = $root.omega_v2.ZKProofBundle.verify(message.proof);
                if (error)
                    return "proof." + error;
            }
            return null;
        };

        /**
         * Creates a TickRollupReceipt message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.TickRollupReceipt} TickRollupReceipt
         */
        TickRollupReceipt.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.TickRollupReceipt)
                return object;
            var message = new $root.omega_v2.TickRollupReceipt();
            if (object.initialHash != null)
                message.initialHash = String(object.initialHash);
            if (object.finalHash != null)
                message.finalHash = String(object.finalHash);
            if (object.proof != null) {
                if (typeof object.proof !== "object")
                    throw TypeError(".omega_v2.TickRollupReceipt.proof: object expected");
                message.proof = $root.omega_v2.ZKProofBundle.fromObject(object.proof);
            }
            return message;
        };

        /**
         * Creates a plain object from a TickRollupReceipt message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {omega_v2.TickRollupReceipt} message TickRollupReceipt
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        TickRollupReceipt.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.initialHash = "";
                object.finalHash = "";
                object.proof = null;
            }
            if (message.initialHash != null && message.hasOwnProperty("initialHash"))
                object.initialHash = message.initialHash;
            if (message.finalHash != null && message.hasOwnProperty("finalHash"))
                object.finalHash = message.finalHash;
            if (message.proof != null && message.hasOwnProperty("proof"))
                object.proof = $root.omega_v2.ZKProofBundle.toObject(message.proof, options);
            return object;
        };

        /**
         * Converts this TickRollupReceipt to JSON.
         * @function toJSON
         * @memberof omega_v2.TickRollupReceipt
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        TickRollupReceipt.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for TickRollupReceipt
         * @function getTypeUrl
         * @memberof omega_v2.TickRollupReceipt
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        TickRollupReceipt.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.TickRollupReceipt";
        };

        return TickRollupReceipt;
    })();

    omega_v2.PlasmidPayload = (function() {

        /**
         * Properties of a PlasmidPayload.
         * @memberof omega_v2
         * @interface IPlasmidPayload
         * @property {string|null} [semanticType] PlasmidPayload semanticType
         * @property {number|null} [attractorAddress] PlasmidPayload attractorAddress
         * @property {number|null} [matrix] PlasmidPayload matrix
         * @property {number|null} [inverse] PlasmidPayload inverse
         * @property {number|null} [pulseFreq] PlasmidPayload pulseFreq
         * @property {number|null} [pulseAmp] PlasmidPayload pulseAmp
         * @property {number|null} [parentHash] PlasmidPayload parentHash
         * @property {number|null} [recursionDepth] PlasmidPayload recursionDepth
         * @property {number|null} [maxRecursion] PlasmidPayload maxRecursion
         * @property {string|null} [proposalHash] PlasmidPayload proposalHash
         * @property {string|null} [proposalDescription] PlasmidPayload proposalDescription
         * @property {boolean|null} [voteAye] PlasmidPayload voteAye
         * @property {string|null} [oracleName] PlasmidPayload oracleName
         * @property {string|null} [oracleReasoning] PlasmidPayload oracleReasoning
         * @property {number|null} [tau] PlasmidPayload tau
         * @property {omega_v2.IPhaseAgentMinimal|null} [parent] PlasmidPayload parent
         * @property {omega_v2.IPhaseAgentMinimal|null} [claimedChild] PlasmidPayload claimedChild
         * @property {Array.<omega_v2.IAttractorMatrix>|null} [attractors] PlasmidPayload attractors
         * @property {number|null} [qPhase] PlasmidPayload qPhase
         * @property {string|null} [receiptHash] PlasmidPayload receiptHash
         * @property {omega_v2.IZKProofBundle|null} [proofBundle] PlasmidPayload proofBundle
         * @property {Uint8Array|null} [rollupState] PlasmidPayload rollupState
         * @property {string|null} [eventSyncBody] PlasmidPayload eventSyncBody
         * @property {number|null} [eventSyncTarget] PlasmidPayload eventSyncTarget
         * @property {string|null} [translationPolicyBody] PlasmidPayload translationPolicyBody
         * @property {number|null} [translationPolicyTarget] PlasmidPayload translationPolicyTarget
         * @property {string|null} [translationPolicyCorroborationBody] PlasmidPayload translationPolicyCorroborationBody
         * @property {number|null} [translationPolicyCorroborationTarget] PlasmidPayload translationPolicyCorroborationTarget
         * @property {string|null} [translationPolicyReplayDigestBody] PlasmidPayload translationPolicyReplayDigestBody
         * @property {number|null} [translationPolicyReplayDigestTarget] PlasmidPayload translationPolicyReplayDigestTarget
         * @property {string|null} [translationPolicyReplayDigestDigestBody] PlasmidPayload translationPolicyReplayDigestDigestBody
         * @property {number|null} [translationPolicyReplayDigestDigestTarget] PlasmidPayload translationPolicyReplayDigestDigestTarget
         * @property {string|null} [tpRddForensicReplayDigestBody] PlasmidPayload tpRddForensicReplayDigestBody
         * @property {number|null} [tpRddForensicReplayDigestTarget] PlasmidPayload tpRddForensicReplayDigestTarget
         */

        /**
         * Constructs a new PlasmidPayload.
         * @memberof omega_v2
         * @classdesc Represents a PlasmidPayload.
         * @implements IPlasmidPayload
         * @constructor
         * @param {omega_v2.IPlasmidPayload=} [properties] Properties to set
         */
        function PlasmidPayload(properties) {
            this.attractors = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PlasmidPayload semanticType.
         * @member {string} semanticType
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.semanticType = "";

        /**
         * PlasmidPayload attractorAddress.
         * @member {number} attractorAddress
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.attractorAddress = 0;

        /**
         * PlasmidPayload matrix.
         * @member {number} matrix
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.matrix = 0;

        /**
         * PlasmidPayload inverse.
         * @member {number} inverse
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.inverse = 0;

        /**
         * PlasmidPayload pulseFreq.
         * @member {number} pulseFreq
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.pulseFreq = 0;

        /**
         * PlasmidPayload pulseAmp.
         * @member {number} pulseAmp
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.pulseAmp = 0;

        /**
         * PlasmidPayload parentHash.
         * @member {number} parentHash
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.parentHash = 0;

        /**
         * PlasmidPayload recursionDepth.
         * @member {number} recursionDepth
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.recursionDepth = 0;

        /**
         * PlasmidPayload maxRecursion.
         * @member {number} maxRecursion
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.maxRecursion = 0;

        /**
         * PlasmidPayload proposalHash.
         * @member {string} proposalHash
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.proposalHash = "";

        /**
         * PlasmidPayload proposalDescription.
         * @member {string} proposalDescription
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.proposalDescription = "";

        /**
         * PlasmidPayload voteAye.
         * @member {boolean} voteAye
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.voteAye = false;

        /**
         * PlasmidPayload oracleName.
         * @member {string} oracleName
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.oracleName = "";

        /**
         * PlasmidPayload oracleReasoning.
         * @member {string} oracleReasoning
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.oracleReasoning = "";

        /**
         * PlasmidPayload tau.
         * @member {number} tau
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.tau = 0;

        /**
         * PlasmidPayload parent.
         * @member {omega_v2.IPhaseAgentMinimal|null|undefined} parent
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.parent = null;

        /**
         * PlasmidPayload claimedChild.
         * @member {omega_v2.IPhaseAgentMinimal|null|undefined} claimedChild
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.claimedChild = null;

        /**
         * PlasmidPayload attractors.
         * @member {Array.<omega_v2.IAttractorMatrix>} attractors
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.attractors = $util.emptyArray;

        /**
         * PlasmidPayload qPhase.
         * @member {number} qPhase
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.qPhase = 0;

        /**
         * PlasmidPayload receiptHash.
         * @member {string} receiptHash
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.receiptHash = "";

        /**
         * PlasmidPayload proofBundle.
         * @member {omega_v2.IZKProofBundle|null|undefined} proofBundle
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.proofBundle = null;

        /**
         * PlasmidPayload rollupState.
         * @member {Uint8Array} rollupState
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.rollupState = $util.newBuffer([]);

        /**
         * PlasmidPayload eventSyncBody.
         * @member {string} eventSyncBody
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.eventSyncBody = "";

        /**
         * PlasmidPayload eventSyncTarget.
         * @member {number} eventSyncTarget
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.eventSyncTarget = 0;

        /**
         * PlasmidPayload translationPolicyBody.
         * @member {string} translationPolicyBody
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.translationPolicyBody = "";

        /**
         * PlasmidPayload translationPolicyTarget.
         * @member {number} translationPolicyTarget
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.translationPolicyTarget = 0;

        /**
         * PlasmidPayload translationPolicyCorroborationBody.
         * @member {string} translationPolicyCorroborationBody
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.translationPolicyCorroborationBody = "";

        /**
         * PlasmidPayload translationPolicyCorroborationTarget.
         * @member {number} translationPolicyCorroborationTarget
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.translationPolicyCorroborationTarget = 0;

        /**
         * PlasmidPayload translationPolicyReplayDigestBody.
         * @member {string} translationPolicyReplayDigestBody
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.translationPolicyReplayDigestBody = "";

        /**
         * PlasmidPayload translationPolicyReplayDigestTarget.
         * @member {number} translationPolicyReplayDigestTarget
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.translationPolicyReplayDigestTarget = 0;

        /**
         * PlasmidPayload translationPolicyReplayDigestDigestBody.
         * @member {string} translationPolicyReplayDigestDigestBody
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.translationPolicyReplayDigestDigestBody = "";

        /**
         * PlasmidPayload translationPolicyReplayDigestDigestTarget.
         * @member {number} translationPolicyReplayDigestDigestTarget
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.translationPolicyReplayDigestDigestTarget = 0;

        /**
         * PlasmidPayload tpRddForensicReplayDigestBody.
         * @member {string} tpRddForensicReplayDigestBody
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.tpRddForensicReplayDigestBody = "";

        /**
         * PlasmidPayload tpRddForensicReplayDigestTarget.
         * @member {number} tpRddForensicReplayDigestTarget
         * @memberof omega_v2.PlasmidPayload
         * @instance
         */
        PlasmidPayload.prototype.tpRddForensicReplayDigestTarget = 0;

        /**
         * Creates a new PlasmidPayload instance using the specified properties.
         * @function create
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {omega_v2.IPlasmidPayload=} [properties] Properties to set
         * @returns {omega_v2.PlasmidPayload} PlasmidPayload instance
         */
        PlasmidPayload.create = function create(properties) {
            return new PlasmidPayload(properties);
        };

        /**
         * Encodes the specified PlasmidPayload message. Does not implicitly {@link omega_v2.PlasmidPayload.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {omega_v2.IPlasmidPayload} message PlasmidPayload message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PlasmidPayload.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.semanticType != null && Object.hasOwnProperty.call(message, "semanticType"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.semanticType);
            if (message.attractorAddress != null && Object.hasOwnProperty.call(message, "attractorAddress"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.attractorAddress);
            if (message.matrix != null && Object.hasOwnProperty.call(message, "matrix"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.matrix);
            if (message.inverse != null && Object.hasOwnProperty.call(message, "inverse"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.inverse);
            if (message.pulseFreq != null && Object.hasOwnProperty.call(message, "pulseFreq"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.pulseFreq);
            if (message.pulseAmp != null && Object.hasOwnProperty.call(message, "pulseAmp"))
                writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.pulseAmp);
            if (message.parentHash != null && Object.hasOwnProperty.call(message, "parentHash"))
                writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.parentHash);
            if (message.recursionDepth != null && Object.hasOwnProperty.call(message, "recursionDepth"))
                writer.uint32(/* id 8, wireType 0 =*/64).uint32(message.recursionDepth);
            if (message.maxRecursion != null && Object.hasOwnProperty.call(message, "maxRecursion"))
                writer.uint32(/* id 9, wireType 0 =*/72).uint32(message.maxRecursion);
            if (message.proposalHash != null && Object.hasOwnProperty.call(message, "proposalHash"))
                writer.uint32(/* id 10, wireType 2 =*/82).string(message.proposalHash);
            if (message.proposalDescription != null && Object.hasOwnProperty.call(message, "proposalDescription"))
                writer.uint32(/* id 11, wireType 2 =*/90).string(message.proposalDescription);
            if (message.voteAye != null && Object.hasOwnProperty.call(message, "voteAye"))
                writer.uint32(/* id 12, wireType 0 =*/96).bool(message.voteAye);
            if (message.oracleName != null && Object.hasOwnProperty.call(message, "oracleName"))
                writer.uint32(/* id 13, wireType 2 =*/106).string(message.oracleName);
            if (message.oracleReasoning != null && Object.hasOwnProperty.call(message, "oracleReasoning"))
                writer.uint32(/* id 14, wireType 2 =*/114).string(message.oracleReasoning);
            if (message.tau != null && Object.hasOwnProperty.call(message, "tau"))
                writer.uint32(/* id 15, wireType 0 =*/120).uint32(message.tau);
            if (message.parent != null && Object.hasOwnProperty.call(message, "parent"))
                $root.omega_v2.PhaseAgentMinimal.encode(message.parent, writer.uint32(/* id 16, wireType 2 =*/130).fork()).ldelim();
            if (message.claimedChild != null && Object.hasOwnProperty.call(message, "claimedChild"))
                $root.omega_v2.PhaseAgentMinimal.encode(message.claimedChild, writer.uint32(/* id 17, wireType 2 =*/138).fork()).ldelim();
            if (message.attractors != null && message.attractors.length)
                for (var i = 0; i < message.attractors.length; ++i)
                    $root.omega_v2.AttractorMatrix.encode(message.attractors[i], writer.uint32(/* id 18, wireType 2 =*/146).fork()).ldelim();
            if (message.qPhase != null && Object.hasOwnProperty.call(message, "qPhase"))
                writer.uint32(/* id 19, wireType 0 =*/152).uint32(message.qPhase);
            if (message.receiptHash != null && Object.hasOwnProperty.call(message, "receiptHash"))
                writer.uint32(/* id 20, wireType 2 =*/162).string(message.receiptHash);
            if (message.proofBundle != null && Object.hasOwnProperty.call(message, "proofBundle"))
                $root.omega_v2.ZKProofBundle.encode(message.proofBundle, writer.uint32(/* id 21, wireType 2 =*/170).fork()).ldelim();
            if (message.rollupState != null && Object.hasOwnProperty.call(message, "rollupState"))
                writer.uint32(/* id 22, wireType 2 =*/178).bytes(message.rollupState);
            if (message.eventSyncBody != null && Object.hasOwnProperty.call(message, "eventSyncBody"))
                writer.uint32(/* id 23, wireType 2 =*/186).string(message.eventSyncBody);
            if (message.eventSyncTarget != null && Object.hasOwnProperty.call(message, "eventSyncTarget"))
                writer.uint32(/* id 24, wireType 0 =*/192).uint32(message.eventSyncTarget);
            if (message.translationPolicyBody != null && Object.hasOwnProperty.call(message, "translationPolicyBody"))
                writer.uint32(/* id 25, wireType 2 =*/202).string(message.translationPolicyBody);
            if (message.translationPolicyTarget != null && Object.hasOwnProperty.call(message, "translationPolicyTarget"))
                writer.uint32(/* id 26, wireType 0 =*/208).uint32(message.translationPolicyTarget);
            if (message.translationPolicyCorroborationBody != null && Object.hasOwnProperty.call(message, "translationPolicyCorroborationBody"))
                writer.uint32(/* id 27, wireType 2 =*/218).string(message.translationPolicyCorroborationBody);
            if (message.translationPolicyCorroborationTarget != null && Object.hasOwnProperty.call(message, "translationPolicyCorroborationTarget"))
                writer.uint32(/* id 28, wireType 0 =*/224).uint32(message.translationPolicyCorroborationTarget);
            if (message.translationPolicyReplayDigestBody != null && Object.hasOwnProperty.call(message, "translationPolicyReplayDigestBody"))
                writer.uint32(/* id 29, wireType 2 =*/234).string(message.translationPolicyReplayDigestBody);
            if (message.translationPolicyReplayDigestTarget != null && Object.hasOwnProperty.call(message, "translationPolicyReplayDigestTarget"))
                writer.uint32(/* id 30, wireType 0 =*/240).uint32(message.translationPolicyReplayDigestTarget);
            if (message.translationPolicyReplayDigestDigestBody != null && Object.hasOwnProperty.call(message, "translationPolicyReplayDigestDigestBody"))
                writer.uint32(/* id 31, wireType 2 =*/250).string(message.translationPolicyReplayDigestDigestBody);
            if (message.translationPolicyReplayDigestDigestTarget != null && Object.hasOwnProperty.call(message, "translationPolicyReplayDigestDigestTarget"))
                writer.uint32(/* id 32, wireType 0 =*/256).uint32(message.translationPolicyReplayDigestDigestTarget);
            if (message.tpRddForensicReplayDigestBody != null && Object.hasOwnProperty.call(message, "tpRddForensicReplayDigestBody"))
                writer.uint32(/* id 33, wireType 2 =*/266).string(message.tpRddForensicReplayDigestBody);
            if (message.tpRddForensicReplayDigestTarget != null && Object.hasOwnProperty.call(message, "tpRddForensicReplayDigestTarget"))
                writer.uint32(/* id 34, wireType 0 =*/272).uint32(message.tpRddForensicReplayDigestTarget);
            return writer;
        };

        /**
         * Encodes the specified PlasmidPayload message, length delimited. Does not implicitly {@link omega_v2.PlasmidPayload.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {omega_v2.IPlasmidPayload} message PlasmidPayload message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PlasmidPayload.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PlasmidPayload message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.PlasmidPayload} PlasmidPayload
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PlasmidPayload.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.PlasmidPayload();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.semanticType = reader.string();
                        break;
                    }
                case 2: {
                        message.attractorAddress = reader.uint32();
                        break;
                    }
                case 3: {
                        message.matrix = reader.uint32();
                        break;
                    }
                case 4: {
                        message.inverse = reader.uint32();
                        break;
                    }
                case 5: {
                        message.pulseFreq = reader.uint32();
                        break;
                    }
                case 6: {
                        message.pulseAmp = reader.uint32();
                        break;
                    }
                case 7: {
                        message.parentHash = reader.uint32();
                        break;
                    }
                case 8: {
                        message.recursionDepth = reader.uint32();
                        break;
                    }
                case 9: {
                        message.maxRecursion = reader.uint32();
                        break;
                    }
                case 10: {
                        message.proposalHash = reader.string();
                        break;
                    }
                case 11: {
                        message.proposalDescription = reader.string();
                        break;
                    }
                case 12: {
                        message.voteAye = reader.bool();
                        break;
                    }
                case 13: {
                        message.oracleName = reader.string();
                        break;
                    }
                case 14: {
                        message.oracleReasoning = reader.string();
                        break;
                    }
                case 15: {
                        message.tau = reader.uint32();
                        break;
                    }
                case 16: {
                        message.parent = $root.omega_v2.PhaseAgentMinimal.decode(reader, reader.uint32());
                        break;
                    }
                case 17: {
                        message.claimedChild = $root.omega_v2.PhaseAgentMinimal.decode(reader, reader.uint32());
                        break;
                    }
                case 18: {
                        if (!(message.attractors && message.attractors.length))
                            message.attractors = [];
                        message.attractors.push($root.omega_v2.AttractorMatrix.decode(reader, reader.uint32()));
                        break;
                    }
                case 19: {
                        message.qPhase = reader.uint32();
                        break;
                    }
                case 20: {
                        message.receiptHash = reader.string();
                        break;
                    }
                case 21: {
                        message.proofBundle = $root.omega_v2.ZKProofBundle.decode(reader, reader.uint32());
                        break;
                    }
                case 22: {
                        message.rollupState = reader.bytes();
                        break;
                    }
                case 23: {
                        message.eventSyncBody = reader.string();
                        break;
                    }
                case 24: {
                        message.eventSyncTarget = reader.uint32();
                        break;
                    }
                case 25: {
                        message.translationPolicyBody = reader.string();
                        break;
                    }
                case 26: {
                        message.translationPolicyTarget = reader.uint32();
                        break;
                    }
                case 27: {
                        message.translationPolicyCorroborationBody = reader.string();
                        break;
                    }
                case 28: {
                        message.translationPolicyCorroborationTarget = reader.uint32();
                        break;
                    }
                case 29: {
                        message.translationPolicyReplayDigestBody = reader.string();
                        break;
                    }
                case 30: {
                        message.translationPolicyReplayDigestTarget = reader.uint32();
                        break;
                    }
                case 31: {
                        message.translationPolicyReplayDigestDigestBody = reader.string();
                        break;
                    }
                case 32: {
                        message.translationPolicyReplayDigestDigestTarget = reader.uint32();
                        break;
                    }
                case 33: {
                        message.tpRddForensicReplayDigestBody = reader.string();
                        break;
                    }
                case 34: {
                        message.tpRddForensicReplayDigestTarget = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a PlasmidPayload message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.PlasmidPayload} PlasmidPayload
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PlasmidPayload.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PlasmidPayload message.
         * @function verify
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PlasmidPayload.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.semanticType != null && message.hasOwnProperty("semanticType"))
                if (!$util.isString(message.semanticType))
                    return "semanticType: string expected";
            if (message.attractorAddress != null && message.hasOwnProperty("attractorAddress"))
                if (!$util.isInteger(message.attractorAddress))
                    return "attractorAddress: integer expected";
            if (message.matrix != null && message.hasOwnProperty("matrix"))
                if (!$util.isInteger(message.matrix))
                    return "matrix: integer expected";
            if (message.inverse != null && message.hasOwnProperty("inverse"))
                if (!$util.isInteger(message.inverse))
                    return "inverse: integer expected";
            if (message.pulseFreq != null && message.hasOwnProperty("pulseFreq"))
                if (!$util.isInteger(message.pulseFreq))
                    return "pulseFreq: integer expected";
            if (message.pulseAmp != null && message.hasOwnProperty("pulseAmp"))
                if (!$util.isInteger(message.pulseAmp))
                    return "pulseAmp: integer expected";
            if (message.parentHash != null && message.hasOwnProperty("parentHash"))
                if (!$util.isInteger(message.parentHash))
                    return "parentHash: integer expected";
            if (message.recursionDepth != null && message.hasOwnProperty("recursionDepth"))
                if (!$util.isInteger(message.recursionDepth))
                    return "recursionDepth: integer expected";
            if (message.maxRecursion != null && message.hasOwnProperty("maxRecursion"))
                if (!$util.isInteger(message.maxRecursion))
                    return "maxRecursion: integer expected";
            if (message.proposalHash != null && message.hasOwnProperty("proposalHash"))
                if (!$util.isString(message.proposalHash))
                    return "proposalHash: string expected";
            if (message.proposalDescription != null && message.hasOwnProperty("proposalDescription"))
                if (!$util.isString(message.proposalDescription))
                    return "proposalDescription: string expected";
            if (message.voteAye != null && message.hasOwnProperty("voteAye"))
                if (typeof message.voteAye !== "boolean")
                    return "voteAye: boolean expected";
            if (message.oracleName != null && message.hasOwnProperty("oracleName"))
                if (!$util.isString(message.oracleName))
                    return "oracleName: string expected";
            if (message.oracleReasoning != null && message.hasOwnProperty("oracleReasoning"))
                if (!$util.isString(message.oracleReasoning))
                    return "oracleReasoning: string expected";
            if (message.tau != null && message.hasOwnProperty("tau"))
                if (!$util.isInteger(message.tau))
                    return "tau: integer expected";
            if (message.parent != null && message.hasOwnProperty("parent")) {
                var error = $root.omega_v2.PhaseAgentMinimal.verify(message.parent);
                if (error)
                    return "parent." + error;
            }
            if (message.claimedChild != null && message.hasOwnProperty("claimedChild")) {
                var error = $root.omega_v2.PhaseAgentMinimal.verify(message.claimedChild);
                if (error)
                    return "claimedChild." + error;
            }
            if (message.attractors != null && message.hasOwnProperty("attractors")) {
                if (!Array.isArray(message.attractors))
                    return "attractors: array expected";
                for (var i = 0; i < message.attractors.length; ++i) {
                    var error = $root.omega_v2.AttractorMatrix.verify(message.attractors[i]);
                    if (error)
                        return "attractors." + error;
                }
            }
            if (message.qPhase != null && message.hasOwnProperty("qPhase"))
                if (!$util.isInteger(message.qPhase))
                    return "qPhase: integer expected";
            if (message.receiptHash != null && message.hasOwnProperty("receiptHash"))
                if (!$util.isString(message.receiptHash))
                    return "receiptHash: string expected";
            if (message.proofBundle != null && message.hasOwnProperty("proofBundle")) {
                var error = $root.omega_v2.ZKProofBundle.verify(message.proofBundle);
                if (error)
                    return "proofBundle." + error;
            }
            if (message.rollupState != null && message.hasOwnProperty("rollupState"))
                if (!(message.rollupState && typeof message.rollupState.length === "number" || $util.isString(message.rollupState)))
                    return "rollupState: buffer expected";
            if (message.eventSyncBody != null && message.hasOwnProperty("eventSyncBody"))
                if (!$util.isString(message.eventSyncBody))
                    return "eventSyncBody: string expected";
            if (message.eventSyncTarget != null && message.hasOwnProperty("eventSyncTarget"))
                if (!$util.isInteger(message.eventSyncTarget))
                    return "eventSyncTarget: integer expected";
            if (message.translationPolicyBody != null && message.hasOwnProperty("translationPolicyBody"))
                if (!$util.isString(message.translationPolicyBody))
                    return "translationPolicyBody: string expected";
            if (message.translationPolicyTarget != null && message.hasOwnProperty("translationPolicyTarget"))
                if (!$util.isInteger(message.translationPolicyTarget))
                    return "translationPolicyTarget: integer expected";
            if (message.translationPolicyCorroborationBody != null && message.hasOwnProperty("translationPolicyCorroborationBody"))
                if (!$util.isString(message.translationPolicyCorroborationBody))
                    return "translationPolicyCorroborationBody: string expected";
            if (message.translationPolicyCorroborationTarget != null && message.hasOwnProperty("translationPolicyCorroborationTarget"))
                if (!$util.isInteger(message.translationPolicyCorroborationTarget))
                    return "translationPolicyCorroborationTarget: integer expected";
            if (message.translationPolicyReplayDigestBody != null && message.hasOwnProperty("translationPolicyReplayDigestBody"))
                if (!$util.isString(message.translationPolicyReplayDigestBody))
                    return "translationPolicyReplayDigestBody: string expected";
            if (message.translationPolicyReplayDigestTarget != null && message.hasOwnProperty("translationPolicyReplayDigestTarget"))
                if (!$util.isInteger(message.translationPolicyReplayDigestTarget))
                    return "translationPolicyReplayDigestTarget: integer expected";
            if (message.translationPolicyReplayDigestDigestBody != null && message.hasOwnProperty("translationPolicyReplayDigestDigestBody"))
                if (!$util.isString(message.translationPolicyReplayDigestDigestBody))
                    return "translationPolicyReplayDigestDigestBody: string expected";
            if (message.translationPolicyReplayDigestDigestTarget != null && message.hasOwnProperty("translationPolicyReplayDigestDigestTarget"))
                if (!$util.isInteger(message.translationPolicyReplayDigestDigestTarget))
                    return "translationPolicyReplayDigestDigestTarget: integer expected";
            if (message.tpRddForensicReplayDigestBody != null && message.hasOwnProperty("tpRddForensicReplayDigestBody"))
                if (!$util.isString(message.tpRddForensicReplayDigestBody))
                    return "tpRddForensicReplayDigestBody: string expected";
            if (message.tpRddForensicReplayDigestTarget != null && message.hasOwnProperty("tpRddForensicReplayDigestTarget"))
                if (!$util.isInteger(message.tpRddForensicReplayDigestTarget))
                    return "tpRddForensicReplayDigestTarget: integer expected";
            return null;
        };

        /**
         * Creates a PlasmidPayload message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.PlasmidPayload} PlasmidPayload
         */
        PlasmidPayload.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.PlasmidPayload)
                return object;
            var message = new $root.omega_v2.PlasmidPayload();
            if (object.semanticType != null)
                message.semanticType = String(object.semanticType);
            if (object.attractorAddress != null)
                message.attractorAddress = object.attractorAddress >>> 0;
            if (object.matrix != null)
                message.matrix = object.matrix >>> 0;
            if (object.inverse != null)
                message.inverse = object.inverse >>> 0;
            if (object.pulseFreq != null)
                message.pulseFreq = object.pulseFreq >>> 0;
            if (object.pulseAmp != null)
                message.pulseAmp = object.pulseAmp >>> 0;
            if (object.parentHash != null)
                message.parentHash = object.parentHash >>> 0;
            if (object.recursionDepth != null)
                message.recursionDepth = object.recursionDepth >>> 0;
            if (object.maxRecursion != null)
                message.maxRecursion = object.maxRecursion >>> 0;
            if (object.proposalHash != null)
                message.proposalHash = String(object.proposalHash);
            if (object.proposalDescription != null)
                message.proposalDescription = String(object.proposalDescription);
            if (object.voteAye != null)
                message.voteAye = Boolean(object.voteAye);
            if (object.oracleName != null)
                message.oracleName = String(object.oracleName);
            if (object.oracleReasoning != null)
                message.oracleReasoning = String(object.oracleReasoning);
            if (object.tau != null)
                message.tau = object.tau >>> 0;
            if (object.parent != null) {
                if (typeof object.parent !== "object")
                    throw TypeError(".omega_v2.PlasmidPayload.parent: object expected");
                message.parent = $root.omega_v2.PhaseAgentMinimal.fromObject(object.parent);
            }
            if (object.claimedChild != null) {
                if (typeof object.claimedChild !== "object")
                    throw TypeError(".omega_v2.PlasmidPayload.claimedChild: object expected");
                message.claimedChild = $root.omega_v2.PhaseAgentMinimal.fromObject(object.claimedChild);
            }
            if (object.attractors) {
                if (!Array.isArray(object.attractors))
                    throw TypeError(".omega_v2.PlasmidPayload.attractors: array expected");
                message.attractors = [];
                for (var i = 0; i < object.attractors.length; ++i) {
                    if (typeof object.attractors[i] !== "object")
                        throw TypeError(".omega_v2.PlasmidPayload.attractors: object expected");
                    message.attractors[i] = $root.omega_v2.AttractorMatrix.fromObject(object.attractors[i]);
                }
            }
            if (object.qPhase != null)
                message.qPhase = object.qPhase >>> 0;
            if (object.receiptHash != null)
                message.receiptHash = String(object.receiptHash);
            if (object.proofBundle != null) {
                if (typeof object.proofBundle !== "object")
                    throw TypeError(".omega_v2.PlasmidPayload.proofBundle: object expected");
                message.proofBundle = $root.omega_v2.ZKProofBundle.fromObject(object.proofBundle);
            }
            if (object.rollupState != null)
                if (typeof object.rollupState === "string")
                    $util.base64.decode(object.rollupState, message.rollupState = $util.newBuffer($util.base64.length(object.rollupState)), 0);
                else if (object.rollupState.length >= 0)
                    message.rollupState = object.rollupState;
            if (object.eventSyncBody != null)
                message.eventSyncBody = String(object.eventSyncBody);
            if (object.eventSyncTarget != null)
                message.eventSyncTarget = object.eventSyncTarget >>> 0;
            if (object.translationPolicyBody != null)
                message.translationPolicyBody = String(object.translationPolicyBody);
            if (object.translationPolicyTarget != null)
                message.translationPolicyTarget = object.translationPolicyTarget >>> 0;
            if (object.translationPolicyCorroborationBody != null)
                message.translationPolicyCorroborationBody = String(object.translationPolicyCorroborationBody);
            if (object.translationPolicyCorroborationTarget != null)
                message.translationPolicyCorroborationTarget = object.translationPolicyCorroborationTarget >>> 0;
            if (object.translationPolicyReplayDigestBody != null)
                message.translationPolicyReplayDigestBody = String(object.translationPolicyReplayDigestBody);
            if (object.translationPolicyReplayDigestTarget != null)
                message.translationPolicyReplayDigestTarget = object.translationPolicyReplayDigestTarget >>> 0;
            if (object.translationPolicyReplayDigestDigestBody != null)
                message.translationPolicyReplayDigestDigestBody = String(object.translationPolicyReplayDigestDigestBody);
            if (object.translationPolicyReplayDigestDigestTarget != null)
                message.translationPolicyReplayDigestDigestTarget = object.translationPolicyReplayDigestDigestTarget >>> 0;
            if (object.tpRddForensicReplayDigestBody != null)
                message.tpRddForensicReplayDigestBody = String(object.tpRddForensicReplayDigestBody);
            if (object.tpRddForensicReplayDigestTarget != null)
                message.tpRddForensicReplayDigestTarget = object.tpRddForensicReplayDigestTarget >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a PlasmidPayload message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {omega_v2.PlasmidPayload} message PlasmidPayload
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PlasmidPayload.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.attractors = [];
            if (options.defaults) {
                object.semanticType = "";
                object.attractorAddress = 0;
                object.matrix = 0;
                object.inverse = 0;
                object.pulseFreq = 0;
                object.pulseAmp = 0;
                object.parentHash = 0;
                object.recursionDepth = 0;
                object.maxRecursion = 0;
                object.proposalHash = "";
                object.proposalDescription = "";
                object.voteAye = false;
                object.oracleName = "";
                object.oracleReasoning = "";
                object.tau = 0;
                object.parent = null;
                object.claimedChild = null;
                object.qPhase = 0;
                object.receiptHash = "";
                object.proofBundle = null;
                if (options.bytes === String)
                    object.rollupState = "";
                else {
                    object.rollupState = [];
                    if (options.bytes !== Array)
                        object.rollupState = $util.newBuffer(object.rollupState);
                }
                object.eventSyncBody = "";
                object.eventSyncTarget = 0;
                object.translationPolicyBody = "";
                object.translationPolicyTarget = 0;
                object.translationPolicyCorroborationBody = "";
                object.translationPolicyCorroborationTarget = 0;
                object.translationPolicyReplayDigestBody = "";
                object.translationPolicyReplayDigestTarget = 0;
                object.translationPolicyReplayDigestDigestBody = "";
                object.translationPolicyReplayDigestDigestTarget = 0;
                object.tpRddForensicReplayDigestBody = "";
                object.tpRddForensicReplayDigestTarget = 0;
            }
            if (message.semanticType != null && message.hasOwnProperty("semanticType"))
                object.semanticType = message.semanticType;
            if (message.attractorAddress != null && message.hasOwnProperty("attractorAddress"))
                object.attractorAddress = message.attractorAddress;
            if (message.matrix != null && message.hasOwnProperty("matrix"))
                object.matrix = message.matrix;
            if (message.inverse != null && message.hasOwnProperty("inverse"))
                object.inverse = message.inverse;
            if (message.pulseFreq != null && message.hasOwnProperty("pulseFreq"))
                object.pulseFreq = message.pulseFreq;
            if (message.pulseAmp != null && message.hasOwnProperty("pulseAmp"))
                object.pulseAmp = message.pulseAmp;
            if (message.parentHash != null && message.hasOwnProperty("parentHash"))
                object.parentHash = message.parentHash;
            if (message.recursionDepth != null && message.hasOwnProperty("recursionDepth"))
                object.recursionDepth = message.recursionDepth;
            if (message.maxRecursion != null && message.hasOwnProperty("maxRecursion"))
                object.maxRecursion = message.maxRecursion;
            if (message.proposalHash != null && message.hasOwnProperty("proposalHash"))
                object.proposalHash = message.proposalHash;
            if (message.proposalDescription != null && message.hasOwnProperty("proposalDescription"))
                object.proposalDescription = message.proposalDescription;
            if (message.voteAye != null && message.hasOwnProperty("voteAye"))
                object.voteAye = message.voteAye;
            if (message.oracleName != null && message.hasOwnProperty("oracleName"))
                object.oracleName = message.oracleName;
            if (message.oracleReasoning != null && message.hasOwnProperty("oracleReasoning"))
                object.oracleReasoning = message.oracleReasoning;
            if (message.tau != null && message.hasOwnProperty("tau"))
                object.tau = message.tau;
            if (message.parent != null && message.hasOwnProperty("parent"))
                object.parent = $root.omega_v2.PhaseAgentMinimal.toObject(message.parent, options);
            if (message.claimedChild != null && message.hasOwnProperty("claimedChild"))
                object.claimedChild = $root.omega_v2.PhaseAgentMinimal.toObject(message.claimedChild, options);
            if (message.attractors && message.attractors.length) {
                object.attractors = [];
                for (var j = 0; j < message.attractors.length; ++j)
                    object.attractors[j] = $root.omega_v2.AttractorMatrix.toObject(message.attractors[j], options);
            }
            if (message.qPhase != null && message.hasOwnProperty("qPhase"))
                object.qPhase = message.qPhase;
            if (message.receiptHash != null && message.hasOwnProperty("receiptHash"))
                object.receiptHash = message.receiptHash;
            if (message.proofBundle != null && message.hasOwnProperty("proofBundle"))
                object.proofBundle = $root.omega_v2.ZKProofBundle.toObject(message.proofBundle, options);
            if (message.rollupState != null && message.hasOwnProperty("rollupState"))
                object.rollupState = options.bytes === String ? $util.base64.encode(message.rollupState, 0, message.rollupState.length) : options.bytes === Array ? Array.prototype.slice.call(message.rollupState) : message.rollupState;
            if (message.eventSyncBody != null && message.hasOwnProperty("eventSyncBody"))
                object.eventSyncBody = message.eventSyncBody;
            if (message.eventSyncTarget != null && message.hasOwnProperty("eventSyncTarget"))
                object.eventSyncTarget = message.eventSyncTarget;
            if (message.translationPolicyBody != null && message.hasOwnProperty("translationPolicyBody"))
                object.translationPolicyBody = message.translationPolicyBody;
            if (message.translationPolicyTarget != null && message.hasOwnProperty("translationPolicyTarget"))
                object.translationPolicyTarget = message.translationPolicyTarget;
            if (message.translationPolicyCorroborationBody != null && message.hasOwnProperty("translationPolicyCorroborationBody"))
                object.translationPolicyCorroborationBody = message.translationPolicyCorroborationBody;
            if (message.translationPolicyCorroborationTarget != null && message.hasOwnProperty("translationPolicyCorroborationTarget"))
                object.translationPolicyCorroborationTarget = message.translationPolicyCorroborationTarget;
            if (message.translationPolicyReplayDigestBody != null && message.hasOwnProperty("translationPolicyReplayDigestBody"))
                object.translationPolicyReplayDigestBody = message.translationPolicyReplayDigestBody;
            if (message.translationPolicyReplayDigestTarget != null && message.hasOwnProperty("translationPolicyReplayDigestTarget"))
                object.translationPolicyReplayDigestTarget = message.translationPolicyReplayDigestTarget;
            if (message.translationPolicyReplayDigestDigestBody != null && message.hasOwnProperty("translationPolicyReplayDigestDigestBody"))
                object.translationPolicyReplayDigestDigestBody = message.translationPolicyReplayDigestDigestBody;
            if (message.translationPolicyReplayDigestDigestTarget != null && message.hasOwnProperty("translationPolicyReplayDigestDigestTarget"))
                object.translationPolicyReplayDigestDigestTarget = message.translationPolicyReplayDigestDigestTarget;
            if (message.tpRddForensicReplayDigestBody != null && message.hasOwnProperty("tpRddForensicReplayDigestBody"))
                object.tpRddForensicReplayDigestBody = message.tpRddForensicReplayDigestBody;
            if (message.tpRddForensicReplayDigestTarget != null && message.hasOwnProperty("tpRddForensicReplayDigestTarget"))
                object.tpRddForensicReplayDigestTarget = message.tpRddForensicReplayDigestTarget;
            return object;
        };

        /**
         * Converts this PlasmidPayload to JSON.
         * @function toJSON
         * @memberof omega_v2.PlasmidPayload
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PlasmidPayload.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PlasmidPayload
         * @function getTypeUrl
         * @memberof omega_v2.PlasmidPayload
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PlasmidPayload.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.PlasmidPayload";
        };

        return PlasmidPayload;
    })();

    omega_v2.OmegaV2Message = (function() {

        /**
         * Properties of an OmegaV2Message.
         * @memberof omega_v2
         * @interface IOmegaV2Message
         * @property {omega_v2.IPlasmidPayload|null} [plasmid] OmegaV2Message plasmid
         * @property {omega_v2.ISporeFrame|null} [spore] OmegaV2Message spore
         */

        /**
         * Constructs a new OmegaV2Message.
         * @memberof omega_v2
         * @classdesc Represents an OmegaV2Message.
         * @implements IOmegaV2Message
         * @constructor
         * @param {omega_v2.IOmegaV2Message=} [properties] Properties to set
         */
        function OmegaV2Message(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * OmegaV2Message plasmid.
         * @member {omega_v2.IPlasmidPayload|null|undefined} plasmid
         * @memberof omega_v2.OmegaV2Message
         * @instance
         */
        OmegaV2Message.prototype.plasmid = null;

        /**
         * OmegaV2Message spore.
         * @member {omega_v2.ISporeFrame|null|undefined} spore
         * @memberof omega_v2.OmegaV2Message
         * @instance
         */
        OmegaV2Message.prototype.spore = null;

        // OneOf field names bound to virtual getters and setters
        var $oneOfFields;

        /**
         * OmegaV2Message payload.
         * @member {"plasmid"|"spore"|undefined} payload
         * @memberof omega_v2.OmegaV2Message
         * @instance
         */
        Object.defineProperty(OmegaV2Message.prototype, "payload", {
            get: $util.oneOfGetter($oneOfFields = ["plasmid", "spore"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new OmegaV2Message instance using the specified properties.
         * @function create
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {omega_v2.IOmegaV2Message=} [properties] Properties to set
         * @returns {omega_v2.OmegaV2Message} OmegaV2Message instance
         */
        OmegaV2Message.create = function create(properties) {
            return new OmegaV2Message(properties);
        };

        /**
         * Encodes the specified OmegaV2Message message. Does not implicitly {@link omega_v2.OmegaV2Message.verify|verify} messages.
         * @function encode
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {omega_v2.IOmegaV2Message} message OmegaV2Message message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        OmegaV2Message.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.plasmid != null && Object.hasOwnProperty.call(message, "plasmid"))
                $root.omega_v2.PlasmidPayload.encode(message.plasmid, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.spore != null && Object.hasOwnProperty.call(message, "spore"))
                $root.omega_v2.SporeFrame.encode(message.spore, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified OmegaV2Message message, length delimited. Does not implicitly {@link omega_v2.OmegaV2Message.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {omega_v2.IOmegaV2Message} message OmegaV2Message message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        OmegaV2Message.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an OmegaV2Message message from the specified reader or buffer.
         * @function decode
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega_v2.OmegaV2Message} OmegaV2Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        OmegaV2Message.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega_v2.OmegaV2Message();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.plasmid = $root.omega_v2.PlasmidPayload.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        message.spore = $root.omega_v2.SporeFrame.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an OmegaV2Message message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega_v2.OmegaV2Message} OmegaV2Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        OmegaV2Message.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an OmegaV2Message message.
         * @function verify
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        OmegaV2Message.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            var properties = {};
            if (message.plasmid != null && message.hasOwnProperty("plasmid")) {
                properties.payload = 1;
                {
                    var error = $root.omega_v2.PlasmidPayload.verify(message.plasmid);
                    if (error)
                        return "plasmid." + error;
                }
            }
            if (message.spore != null && message.hasOwnProperty("spore")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    var error = $root.omega_v2.SporeFrame.verify(message.spore);
                    if (error)
                        return "spore." + error;
                }
            }
            return null;
        };

        /**
         * Creates an OmegaV2Message message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega_v2.OmegaV2Message} OmegaV2Message
         */
        OmegaV2Message.fromObject = function fromObject(object) {
            if (object instanceof $root.omega_v2.OmegaV2Message)
                return object;
            var message = new $root.omega_v2.OmegaV2Message();
            if (object.plasmid != null) {
                if (typeof object.plasmid !== "object")
                    throw TypeError(".omega_v2.OmegaV2Message.plasmid: object expected");
                message.plasmid = $root.omega_v2.PlasmidPayload.fromObject(object.plasmid);
            }
            if (object.spore != null) {
                if (typeof object.spore !== "object")
                    throw TypeError(".omega_v2.OmegaV2Message.spore: object expected");
                message.spore = $root.omega_v2.SporeFrame.fromObject(object.spore);
            }
            return message;
        };

        /**
         * Creates a plain object from an OmegaV2Message message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {omega_v2.OmegaV2Message} message OmegaV2Message
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        OmegaV2Message.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (message.plasmid != null && message.hasOwnProperty("plasmid")) {
                object.plasmid = $root.omega_v2.PlasmidPayload.toObject(message.plasmid, options);
                if (options.oneofs)
                    object.payload = "plasmid";
            }
            if (message.spore != null && message.hasOwnProperty("spore")) {
                object.spore = $root.omega_v2.SporeFrame.toObject(message.spore, options);
                if (options.oneofs)
                    object.payload = "spore";
            }
            return object;
        };

        /**
         * Converts this OmegaV2Message to JSON.
         * @function toJSON
         * @memberof omega_v2.OmegaV2Message
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        OmegaV2Message.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for OmegaV2Message
         * @function getTypeUrl
         * @memberof omega_v2.OmegaV2Message
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        OmegaV2Message.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega_v2.OmegaV2Message";
        };

        return OmegaV2Message;
    })();

    return omega_v2;
})();

module.exports = $root;
