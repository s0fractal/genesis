/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const omega64 = $root.omega64 = (() => {

    /**
     * Namespace omega64.
     * @exports omega64
     * @namespace
     */
    const omega64 = {};

    omega64.NetworkPhenotype = (function() {

        /**
         * Properties of a NetworkPhenotype.
         * @memberof omega64
         * @interface INetworkPhenotype
         * @property {string|null} [behavior] NetworkPhenotype behavior
         * @property {number|null} [latency] NetworkPhenotype latency
         * @property {number|null} [replicationCost] NetworkPhenotype replicationCost
         * @property {string|null} [networkSignature] NetworkPhenotype networkSignature
         * @property {string|null} [targetAlignment] NetworkPhenotype targetAlignment
         */

        /**
         * Constructs a new NetworkPhenotype.
         * @memberof omega64
         * @classdesc Represents a NetworkPhenotype.
         * @implements INetworkPhenotype
         * @constructor
         * @param {omega64.INetworkPhenotype=} [properties] Properties to set
         */
        function NetworkPhenotype(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * NetworkPhenotype behavior.
         * @member {string} behavior
         * @memberof omega64.NetworkPhenotype
         * @instance
         */
        NetworkPhenotype.prototype.behavior = "";

        /**
         * NetworkPhenotype latency.
         * @member {number} latency
         * @memberof omega64.NetworkPhenotype
         * @instance
         */
        NetworkPhenotype.prototype.latency = 0;

        /**
         * NetworkPhenotype replicationCost.
         * @member {number} replicationCost
         * @memberof omega64.NetworkPhenotype
         * @instance
         */
        NetworkPhenotype.prototype.replicationCost = 0;

        /**
         * NetworkPhenotype networkSignature.
         * @member {string} networkSignature
         * @memberof omega64.NetworkPhenotype
         * @instance
         */
        NetworkPhenotype.prototype.networkSignature = "";

        /**
         * NetworkPhenotype targetAlignment.
         * @member {string} targetAlignment
         * @memberof omega64.NetworkPhenotype
         * @instance
         */
        NetworkPhenotype.prototype.targetAlignment = "";

        /**
         * Creates a new NetworkPhenotype instance using the specified properties.
         * @function create
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {omega64.INetworkPhenotype=} [properties] Properties to set
         * @returns {omega64.NetworkPhenotype} NetworkPhenotype instance
         */
        NetworkPhenotype.create = function create(properties) {
            return new NetworkPhenotype(properties);
        };

        /**
         * Encodes the specified NetworkPhenotype message. Does not implicitly {@link omega64.NetworkPhenotype.verify|verify} messages.
         * @function encode
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {omega64.INetworkPhenotype} message NetworkPhenotype message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NetworkPhenotype.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.behavior != null && Object.hasOwnProperty.call(message, "behavior"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.behavior);
            if (message.latency != null && Object.hasOwnProperty.call(message, "latency"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.latency);
            if (message.replicationCost != null && Object.hasOwnProperty.call(message, "replicationCost"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.replicationCost);
            if (message.networkSignature != null && Object.hasOwnProperty.call(message, "networkSignature"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.networkSignature);
            if (message.targetAlignment != null && Object.hasOwnProperty.call(message, "targetAlignment"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.targetAlignment);
            return writer;
        };

        /**
         * Encodes the specified NetworkPhenotype message, length delimited. Does not implicitly {@link omega64.NetworkPhenotype.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {omega64.INetworkPhenotype} message NetworkPhenotype message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NetworkPhenotype.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a NetworkPhenotype message from the specified reader or buffer.
         * @function decode
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega64.NetworkPhenotype} NetworkPhenotype
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NetworkPhenotype.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega64.NetworkPhenotype();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.behavior = reader.string();
                        break;
                    }
                case 2: {
                        message.latency = reader.float();
                        break;
                    }
                case 3: {
                        message.replicationCost = reader.float();
                        break;
                    }
                case 4: {
                        message.networkSignature = reader.string();
                        break;
                    }
                case 5: {
                        message.targetAlignment = reader.string();
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
         * Decodes a NetworkPhenotype message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega64.NetworkPhenotype} NetworkPhenotype
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NetworkPhenotype.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a NetworkPhenotype message.
         * @function verify
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        NetworkPhenotype.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.behavior != null && message.hasOwnProperty("behavior"))
                if (!$util.isString(message.behavior))
                    return "behavior: string expected";
            if (message.latency != null && message.hasOwnProperty("latency"))
                if (typeof message.latency !== "number")
                    return "latency: number expected";
            if (message.replicationCost != null && message.hasOwnProperty("replicationCost"))
                if (typeof message.replicationCost !== "number")
                    return "replicationCost: number expected";
            if (message.networkSignature != null && message.hasOwnProperty("networkSignature"))
                if (!$util.isString(message.networkSignature))
                    return "networkSignature: string expected";
            if (message.targetAlignment != null && message.hasOwnProperty("targetAlignment"))
                if (!$util.isString(message.targetAlignment))
                    return "targetAlignment: string expected";
            return null;
        };

        /**
         * Creates a NetworkPhenotype message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega64.NetworkPhenotype} NetworkPhenotype
         */
        NetworkPhenotype.fromObject = function fromObject(object) {
            if (object instanceof $root.omega64.NetworkPhenotype)
                return object;
            let message = new $root.omega64.NetworkPhenotype();
            if (object.behavior != null)
                message.behavior = String(object.behavior);
            if (object.latency != null)
                message.latency = Number(object.latency);
            if (object.replicationCost != null)
                message.replicationCost = Number(object.replicationCost);
            if (object.networkSignature != null)
                message.networkSignature = String(object.networkSignature);
            if (object.targetAlignment != null)
                message.targetAlignment = String(object.targetAlignment);
            return message;
        };

        /**
         * Creates a plain object from a NetworkPhenotype message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {omega64.NetworkPhenotype} message NetworkPhenotype
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        NetworkPhenotype.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.behavior = "";
                object.latency = 0;
                object.replicationCost = 0;
                object.networkSignature = "";
                object.targetAlignment = "";
            }
            if (message.behavior != null && message.hasOwnProperty("behavior"))
                object.behavior = message.behavior;
            if (message.latency != null && message.hasOwnProperty("latency"))
                object.latency = options.json && !isFinite(message.latency) ? String(message.latency) : message.latency;
            if (message.replicationCost != null && message.hasOwnProperty("replicationCost"))
                object.replicationCost = options.json && !isFinite(message.replicationCost) ? String(message.replicationCost) : message.replicationCost;
            if (message.networkSignature != null && message.hasOwnProperty("networkSignature"))
                object.networkSignature = message.networkSignature;
            if (message.targetAlignment != null && message.hasOwnProperty("targetAlignment"))
                object.targetAlignment = message.targetAlignment;
            return object;
        };

        /**
         * Converts this NetworkPhenotype to JSON.
         * @function toJSON
         * @memberof omega64.NetworkPhenotype
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        NetworkPhenotype.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for NetworkPhenotype
         * @function getTypeUrl
         * @memberof omega64.NetworkPhenotype
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        NetworkPhenotype.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega64.NetworkPhenotype";
        };

        return NetworkPhenotype;
    })();

    omega64.UniversalCoordinate = (function() {

        /**
         * Properties of an UniversalCoordinate.
         * @memberof omega64
         * @interface IUniversalCoordinate
         * @property {number|null} [u] UniversalCoordinate u
         * @property {number|null} [v] UniversalCoordinate v
         * @property {number|null} [w] UniversalCoordinate w
         */

        /**
         * Constructs a new UniversalCoordinate.
         * @memberof omega64
         * @classdesc Represents an UniversalCoordinate.
         * @implements IUniversalCoordinate
         * @constructor
         * @param {omega64.IUniversalCoordinate=} [properties] Properties to set
         */
        function UniversalCoordinate(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UniversalCoordinate u.
         * @member {number} u
         * @memberof omega64.UniversalCoordinate
         * @instance
         */
        UniversalCoordinate.prototype.u = 0;

        /**
         * UniversalCoordinate v.
         * @member {number} v
         * @memberof omega64.UniversalCoordinate
         * @instance
         */
        UniversalCoordinate.prototype.v = 0;

        /**
         * UniversalCoordinate w.
         * @member {number} w
         * @memberof omega64.UniversalCoordinate
         * @instance
         */
        UniversalCoordinate.prototype.w = 0;

        /**
         * Creates a new UniversalCoordinate instance using the specified properties.
         * @function create
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {omega64.IUniversalCoordinate=} [properties] Properties to set
         * @returns {omega64.UniversalCoordinate} UniversalCoordinate instance
         */
        UniversalCoordinate.create = function create(properties) {
            return new UniversalCoordinate(properties);
        };

        /**
         * Encodes the specified UniversalCoordinate message. Does not implicitly {@link omega64.UniversalCoordinate.verify|verify} messages.
         * @function encode
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {omega64.IUniversalCoordinate} message UniversalCoordinate message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UniversalCoordinate.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.u != null && Object.hasOwnProperty.call(message, "u"))
                writer.uint32(/* id 1, wireType 5 =*/13).float(message.u);
            if (message.v != null && Object.hasOwnProperty.call(message, "v"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.v);
            if (message.w != null && Object.hasOwnProperty.call(message, "w"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.w);
            return writer;
        };

        /**
         * Encodes the specified UniversalCoordinate message, length delimited. Does not implicitly {@link omega64.UniversalCoordinate.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {omega64.IUniversalCoordinate} message UniversalCoordinate message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UniversalCoordinate.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an UniversalCoordinate message from the specified reader or buffer.
         * @function decode
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega64.UniversalCoordinate} UniversalCoordinate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UniversalCoordinate.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega64.UniversalCoordinate();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.u = reader.float();
                        break;
                    }
                case 2: {
                        message.v = reader.float();
                        break;
                    }
                case 3: {
                        message.w = reader.float();
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
         * Decodes an UniversalCoordinate message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega64.UniversalCoordinate} UniversalCoordinate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UniversalCoordinate.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an UniversalCoordinate message.
         * @function verify
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UniversalCoordinate.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.u != null && message.hasOwnProperty("u"))
                if (typeof message.u !== "number")
                    return "u: number expected";
            if (message.v != null && message.hasOwnProperty("v"))
                if (typeof message.v !== "number")
                    return "v: number expected";
            if (message.w != null && message.hasOwnProperty("w"))
                if (typeof message.w !== "number")
                    return "w: number expected";
            return null;
        };

        /**
         * Creates an UniversalCoordinate message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega64.UniversalCoordinate} UniversalCoordinate
         */
        UniversalCoordinate.fromObject = function fromObject(object) {
            if (object instanceof $root.omega64.UniversalCoordinate)
                return object;
            let message = new $root.omega64.UniversalCoordinate();
            if (object.u != null)
                message.u = Number(object.u);
            if (object.v != null)
                message.v = Number(object.v);
            if (object.w != null)
                message.w = Number(object.w);
            return message;
        };

        /**
         * Creates a plain object from an UniversalCoordinate message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {omega64.UniversalCoordinate} message UniversalCoordinate
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UniversalCoordinate.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.u = 0;
                object.v = 0;
                object.w = 0;
            }
            if (message.u != null && message.hasOwnProperty("u"))
                object.u = options.json && !isFinite(message.u) ? String(message.u) : message.u;
            if (message.v != null && message.hasOwnProperty("v"))
                object.v = options.json && !isFinite(message.v) ? String(message.v) : message.v;
            if (message.w != null && message.hasOwnProperty("w"))
                object.w = options.json && !isFinite(message.w) ? String(message.w) : message.w;
            return object;
        };

        /**
         * Converts this UniversalCoordinate to JSON.
         * @function toJSON
         * @memberof omega64.UniversalCoordinate
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UniversalCoordinate.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UniversalCoordinate
         * @function getTypeUrl
         * @memberof omega64.UniversalCoordinate
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UniversalCoordinate.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega64.UniversalCoordinate";
        };

        return UniversalCoordinate;
    })();

    omega64.ForeignPlasmid = (function() {

        /**
         * Properties of a ForeignPlasmid.
         * @memberof omega64
         * @interface IForeignPlasmid
         * @property {string|null} [hash] ForeignPlasmid hash
         * @property {string|null} [astStr] ForeignPlasmid astStr
         * @property {number|null} [energy] ForeignPlasmid energy
         * @property {omega64.IUniversalCoordinate|null} [target] ForeignPlasmid target
         * @property {string|null} [origin] ForeignPlasmid origin
         * @property {Array.<string>|null} [parents] ForeignPlasmid parents
         * @property {string|null} [signature] ForeignPlasmid signature
         * @property {Object.<string,number>|null} [vectorClock] ForeignPlasmid vectorClock
         * @property {omega64.INetworkPhenotype|null} [phenotype] ForeignPlasmid phenotype
         * @property {string|null} [proofBytes] ForeignPlasmid proofBytes
         * @property {string|null} [morphologyHash] ForeignPlasmid morphologyHash
         * @property {number|null} [stepsCost] ForeignPlasmid stepsCost
         * @property {string|null} [burnTxHash] ForeignPlasmid burnTxHash
         */

        /**
         * Constructs a new ForeignPlasmid.
         * @memberof omega64
         * @classdesc Represents a ForeignPlasmid.
         * @implements IForeignPlasmid
         * @constructor
         * @param {omega64.IForeignPlasmid=} [properties] Properties to set
         */
        function ForeignPlasmid(properties) {
            this.parents = [];
            this.vectorClock = {};
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ForeignPlasmid hash.
         * @member {string} hash
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.hash = "";

        /**
         * ForeignPlasmid astStr.
         * @member {string} astStr
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.astStr = "";

        /**
         * ForeignPlasmid energy.
         * @member {number} energy
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.energy = 0;

        /**
         * ForeignPlasmid target.
         * @member {omega64.IUniversalCoordinate|null|undefined} target
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.target = null;

        /**
         * ForeignPlasmid origin.
         * @member {string} origin
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.origin = "";

        /**
         * ForeignPlasmid parents.
         * @member {Array.<string>} parents
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.parents = $util.emptyArray;

        /**
         * ForeignPlasmid signature.
         * @member {string} signature
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.signature = "";

        /**
         * ForeignPlasmid vectorClock.
         * @member {Object.<string,number>} vectorClock
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.vectorClock = $util.emptyObject;

        /**
         * ForeignPlasmid phenotype.
         * @member {omega64.INetworkPhenotype|null|undefined} phenotype
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.phenotype = null;

        /**
         * ForeignPlasmid proofBytes.
         * @member {string} proofBytes
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.proofBytes = "";

        /**
         * ForeignPlasmid morphologyHash.
         * @member {string} morphologyHash
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.morphologyHash = "";

        /**
         * ForeignPlasmid stepsCost.
         * @member {number} stepsCost
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.stepsCost = 0;

        /**
         * ForeignPlasmid burnTxHash.
         * @member {string} burnTxHash
         * @memberof omega64.ForeignPlasmid
         * @instance
         */
        ForeignPlasmid.prototype.burnTxHash = "";

        /**
         * Creates a new ForeignPlasmid instance using the specified properties.
         * @function create
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {omega64.IForeignPlasmid=} [properties] Properties to set
         * @returns {omega64.ForeignPlasmid} ForeignPlasmid instance
         */
        ForeignPlasmid.create = function create(properties) {
            return new ForeignPlasmid(properties);
        };

        /**
         * Encodes the specified ForeignPlasmid message. Does not implicitly {@link omega64.ForeignPlasmid.verify|verify} messages.
         * @function encode
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {omega64.IForeignPlasmid} message ForeignPlasmid message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ForeignPlasmid.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.hash);
            if (message.astStr != null && Object.hasOwnProperty.call(message, "astStr"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.astStr);
            if (message.energy != null && Object.hasOwnProperty.call(message, "energy"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.energy);
            if (message.target != null && Object.hasOwnProperty.call(message, "target"))
                $root.omega64.UniversalCoordinate.encode(message.target, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.origin != null && Object.hasOwnProperty.call(message, "origin"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.origin);
            if (message.parents != null && message.parents.length)
                for (let i = 0; i < message.parents.length; ++i)
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.parents[i]);
            if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
                writer.uint32(/* id 7, wireType 2 =*/58).string(message.signature);
            if (message.vectorClock != null && Object.hasOwnProperty.call(message, "vectorClock"))
                for (let keys = Object.keys(message.vectorClock), i = 0; i < keys.length; ++i)
                    writer.uint32(/* id 8, wireType 2 =*/66).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 0 =*/16).uint32(message.vectorClock[keys[i]]).ldelim();
            if (message.phenotype != null && Object.hasOwnProperty.call(message, "phenotype"))
                $root.omega64.NetworkPhenotype.encode(message.phenotype, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
            if (message.proofBytes != null && Object.hasOwnProperty.call(message, "proofBytes"))
                writer.uint32(/* id 10, wireType 2 =*/82).string(message.proofBytes);
            if (message.morphologyHash != null && Object.hasOwnProperty.call(message, "morphologyHash"))
                writer.uint32(/* id 11, wireType 2 =*/90).string(message.morphologyHash);
            if (message.stepsCost != null && Object.hasOwnProperty.call(message, "stepsCost"))
                writer.uint32(/* id 12, wireType 0 =*/96).uint32(message.stepsCost);
            if (message.burnTxHash != null && Object.hasOwnProperty.call(message, "burnTxHash"))
                writer.uint32(/* id 13, wireType 2 =*/106).string(message.burnTxHash);
            return writer;
        };

        /**
         * Encodes the specified ForeignPlasmid message, length delimited. Does not implicitly {@link omega64.ForeignPlasmid.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {omega64.IForeignPlasmid} message ForeignPlasmid message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ForeignPlasmid.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ForeignPlasmid message from the specified reader or buffer.
         * @function decode
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega64.ForeignPlasmid} ForeignPlasmid
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ForeignPlasmid.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega64.ForeignPlasmid(), key, value;
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.hash = reader.string();
                        break;
                    }
                case 2: {
                        message.astStr = reader.string();
                        break;
                    }
                case 3: {
                        message.energy = reader.float();
                        break;
                    }
                case 4: {
                        message.target = $root.omega64.UniversalCoordinate.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        message.origin = reader.string();
                        break;
                    }
                case 6: {
                        if (!(message.parents && message.parents.length))
                            message.parents = [];
                        message.parents.push(reader.string());
                        break;
                    }
                case 7: {
                        message.signature = reader.string();
                        break;
                    }
                case 8: {
                        if (message.vectorClock === $util.emptyObject)
                            message.vectorClock = {};
                        let end2 = reader.uint32() + reader.pos;
                        key = "";
                        value = 0;
                        while (reader.pos < end2) {
                            let tag2 = reader.uint32();
                            switch (tag2 >>> 3) {
                            case 1:
                                key = reader.string();
                                break;
                            case 2:
                                value = reader.uint32();
                                break;
                            default:
                                reader.skipType(tag2 & 7);
                                break;
                            }
                        }
                        message.vectorClock[key] = value;
                        break;
                    }
                case 9: {
                        message.phenotype = $root.omega64.NetworkPhenotype.decode(reader, reader.uint32());
                        break;
                    }
                case 10: {
                        message.proofBytes = reader.string();
                        break;
                    }
                case 11: {
                        message.morphologyHash = reader.string();
                        break;
                    }
                case 12: {
                        message.stepsCost = reader.uint32();
                        break;
                    }
                case 13: {
                        message.burnTxHash = reader.string();
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
         * Decodes a ForeignPlasmid message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega64.ForeignPlasmid} ForeignPlasmid
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ForeignPlasmid.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ForeignPlasmid message.
         * @function verify
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ForeignPlasmid.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.hash != null && message.hasOwnProperty("hash"))
                if (!$util.isString(message.hash))
                    return "hash: string expected";
            if (message.astStr != null && message.hasOwnProperty("astStr"))
                if (!$util.isString(message.astStr))
                    return "astStr: string expected";
            if (message.energy != null && message.hasOwnProperty("energy"))
                if (typeof message.energy !== "number")
                    return "energy: number expected";
            if (message.target != null && message.hasOwnProperty("target")) {
                let error = $root.omega64.UniversalCoordinate.verify(message.target);
                if (error)
                    return "target." + error;
            }
            if (message.origin != null && message.hasOwnProperty("origin"))
                if (!$util.isString(message.origin))
                    return "origin: string expected";
            if (message.parents != null && message.hasOwnProperty("parents")) {
                if (!Array.isArray(message.parents))
                    return "parents: array expected";
                for (let i = 0; i < message.parents.length; ++i)
                    if (!$util.isString(message.parents[i]))
                        return "parents: string[] expected";
            }
            if (message.signature != null && message.hasOwnProperty("signature"))
                if (!$util.isString(message.signature))
                    return "signature: string expected";
            if (message.vectorClock != null && message.hasOwnProperty("vectorClock")) {
                if (!$util.isObject(message.vectorClock))
                    return "vectorClock: object expected";
                let key = Object.keys(message.vectorClock);
                for (let i = 0; i < key.length; ++i)
                    if (!$util.isInteger(message.vectorClock[key[i]]))
                        return "vectorClock: integer{k:string} expected";
            }
            if (message.phenotype != null && message.hasOwnProperty("phenotype")) {
                let error = $root.omega64.NetworkPhenotype.verify(message.phenotype);
                if (error)
                    return "phenotype." + error;
            }
            if (message.proofBytes != null && message.hasOwnProperty("proofBytes"))
                if (!$util.isString(message.proofBytes))
                    return "proofBytes: string expected";
            if (message.morphologyHash != null && message.hasOwnProperty("morphologyHash"))
                if (!$util.isString(message.morphologyHash))
                    return "morphologyHash: string expected";
            if (message.stepsCost != null && message.hasOwnProperty("stepsCost"))
                if (!$util.isInteger(message.stepsCost))
                    return "stepsCost: integer expected";
            if (message.burnTxHash != null && message.hasOwnProperty("burnTxHash"))
                if (!$util.isString(message.burnTxHash))
                    return "burnTxHash: string expected";
            return null;
        };

        /**
         * Creates a ForeignPlasmid message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega64.ForeignPlasmid} ForeignPlasmid
         */
        ForeignPlasmid.fromObject = function fromObject(object) {
            if (object instanceof $root.omega64.ForeignPlasmid)
                return object;
            let message = new $root.omega64.ForeignPlasmid();
            if (object.hash != null)
                message.hash = String(object.hash);
            if (object.astStr != null)
                message.astStr = String(object.astStr);
            if (object.energy != null)
                message.energy = Number(object.energy);
            if (object.target != null) {
                if (typeof object.target !== "object")
                    throw TypeError(".omega64.ForeignPlasmid.target: object expected");
                message.target = $root.omega64.UniversalCoordinate.fromObject(object.target);
            }
            if (object.origin != null)
                message.origin = String(object.origin);
            if (object.parents) {
                if (!Array.isArray(object.parents))
                    throw TypeError(".omega64.ForeignPlasmid.parents: array expected");
                message.parents = [];
                for (let i = 0; i < object.parents.length; ++i)
                    message.parents[i] = String(object.parents[i]);
            }
            if (object.signature != null)
                message.signature = String(object.signature);
            if (object.vectorClock) {
                if (typeof object.vectorClock !== "object")
                    throw TypeError(".omega64.ForeignPlasmid.vectorClock: object expected");
                message.vectorClock = {};
                for (let keys = Object.keys(object.vectorClock), i = 0; i < keys.length; ++i)
                    message.vectorClock[keys[i]] = object.vectorClock[keys[i]] >>> 0;
            }
            if (object.phenotype != null) {
                if (typeof object.phenotype !== "object")
                    throw TypeError(".omega64.ForeignPlasmid.phenotype: object expected");
                message.phenotype = $root.omega64.NetworkPhenotype.fromObject(object.phenotype);
            }
            if (object.proofBytes != null)
                message.proofBytes = String(object.proofBytes);
            if (object.morphologyHash != null)
                message.morphologyHash = String(object.morphologyHash);
            if (object.stepsCost != null)
                message.stepsCost = object.stepsCost >>> 0;
            if (object.burnTxHash != null)
                message.burnTxHash = String(object.burnTxHash);
            return message;
        };

        /**
         * Creates a plain object from a ForeignPlasmid message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {omega64.ForeignPlasmid} message ForeignPlasmid
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ForeignPlasmid.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.parents = [];
            if (options.objects || options.defaults)
                object.vectorClock = {};
            if (options.defaults) {
                object.hash = "";
                object.astStr = "";
                object.energy = 0;
                object.target = null;
                object.origin = "";
                object.signature = "";
                object.phenotype = null;
                object.proofBytes = "";
                object.morphologyHash = "";
                object.stepsCost = 0;
                object.burnTxHash = "";
            }
            if (message.hash != null && message.hasOwnProperty("hash"))
                object.hash = message.hash;
            if (message.astStr != null && message.hasOwnProperty("astStr"))
                object.astStr = message.astStr;
            if (message.energy != null && message.hasOwnProperty("energy"))
                object.energy = options.json && !isFinite(message.energy) ? String(message.energy) : message.energy;
            if (message.target != null && message.hasOwnProperty("target"))
                object.target = $root.omega64.UniversalCoordinate.toObject(message.target, options);
            if (message.origin != null && message.hasOwnProperty("origin"))
                object.origin = message.origin;
            if (message.parents && message.parents.length) {
                object.parents = [];
                for (let j = 0; j < message.parents.length; ++j)
                    object.parents[j] = message.parents[j];
            }
            if (message.signature != null && message.hasOwnProperty("signature"))
                object.signature = message.signature;
            let keys2;
            if (message.vectorClock && (keys2 = Object.keys(message.vectorClock)).length) {
                object.vectorClock = {};
                for (let j = 0; j < keys2.length; ++j)
                    object.vectorClock[keys2[j]] = message.vectorClock[keys2[j]];
            }
            if (message.phenotype != null && message.hasOwnProperty("phenotype"))
                object.phenotype = $root.omega64.NetworkPhenotype.toObject(message.phenotype, options);
            if (message.proofBytes != null && message.hasOwnProperty("proofBytes"))
                object.proofBytes = message.proofBytes;
            if (message.morphologyHash != null && message.hasOwnProperty("morphologyHash"))
                object.morphologyHash = message.morphologyHash;
            if (message.stepsCost != null && message.hasOwnProperty("stepsCost"))
                object.stepsCost = message.stepsCost;
            if (message.burnTxHash != null && message.hasOwnProperty("burnTxHash"))
                object.burnTxHash = message.burnTxHash;
            return object;
        };

        /**
         * Converts this ForeignPlasmid to JSON.
         * @function toJSON
         * @memberof omega64.ForeignPlasmid
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ForeignPlasmid.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ForeignPlasmid
         * @function getTypeUrl
         * @memberof omega64.ForeignPlasmid
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ForeignPlasmid.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega64.ForeignPlasmid";
        };

        return ForeignPlasmid;
    })();

    omega64.ImpactEvent = (function() {

        /**
         * Properties of an ImpactEvent.
         * @memberof omega64
         * @interface IImpactEvent
         * @property {omega64.IUniversalCoordinate|null} [target] ImpactEvent target
         * @property {number|null} [energy] ImpactEvent energy
         * @property {string|null} [astHash] ImpactEvent astHash
         * @property {string|null} [signature] ImpactEvent signature
         */

        /**
         * Constructs a new ImpactEvent.
         * @memberof omega64
         * @classdesc Represents an ImpactEvent.
         * @implements IImpactEvent
         * @constructor
         * @param {omega64.IImpactEvent=} [properties] Properties to set
         */
        function ImpactEvent(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ImpactEvent target.
         * @member {omega64.IUniversalCoordinate|null|undefined} target
         * @memberof omega64.ImpactEvent
         * @instance
         */
        ImpactEvent.prototype.target = null;

        /**
         * ImpactEvent energy.
         * @member {number} energy
         * @memberof omega64.ImpactEvent
         * @instance
         */
        ImpactEvent.prototype.energy = 0;

        /**
         * ImpactEvent astHash.
         * @member {string} astHash
         * @memberof omega64.ImpactEvent
         * @instance
         */
        ImpactEvent.prototype.astHash = "";

        /**
         * ImpactEvent signature.
         * @member {string} signature
         * @memberof omega64.ImpactEvent
         * @instance
         */
        ImpactEvent.prototype.signature = "";

        /**
         * Creates a new ImpactEvent instance using the specified properties.
         * @function create
         * @memberof omega64.ImpactEvent
         * @static
         * @param {omega64.IImpactEvent=} [properties] Properties to set
         * @returns {omega64.ImpactEvent} ImpactEvent instance
         */
        ImpactEvent.create = function create(properties) {
            return new ImpactEvent(properties);
        };

        /**
         * Encodes the specified ImpactEvent message. Does not implicitly {@link omega64.ImpactEvent.verify|verify} messages.
         * @function encode
         * @memberof omega64.ImpactEvent
         * @static
         * @param {omega64.IImpactEvent} message ImpactEvent message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ImpactEvent.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.target != null && Object.hasOwnProperty.call(message, "target"))
                $root.omega64.UniversalCoordinate.encode(message.target, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.energy != null && Object.hasOwnProperty.call(message, "energy"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.energy);
            if (message.astHash != null && Object.hasOwnProperty.call(message, "astHash"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.astHash);
            if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.signature);
            return writer;
        };

        /**
         * Encodes the specified ImpactEvent message, length delimited. Does not implicitly {@link omega64.ImpactEvent.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega64.ImpactEvent
         * @static
         * @param {omega64.IImpactEvent} message ImpactEvent message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ImpactEvent.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an ImpactEvent message from the specified reader or buffer.
         * @function decode
         * @memberof omega64.ImpactEvent
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega64.ImpactEvent} ImpactEvent
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ImpactEvent.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega64.ImpactEvent();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.target = $root.omega64.UniversalCoordinate.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.energy = reader.float();
                        break;
                    }
                case 4: {
                        message.astHash = reader.string();
                        break;
                    }
                case 5: {
                        message.signature = reader.string();
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
         * Decodes an ImpactEvent message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega64.ImpactEvent
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega64.ImpactEvent} ImpactEvent
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ImpactEvent.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an ImpactEvent message.
         * @function verify
         * @memberof omega64.ImpactEvent
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ImpactEvent.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.target != null && message.hasOwnProperty("target")) {
                let error = $root.omega64.UniversalCoordinate.verify(message.target);
                if (error)
                    return "target." + error;
            }
            if (message.energy != null && message.hasOwnProperty("energy"))
                if (typeof message.energy !== "number")
                    return "energy: number expected";
            if (message.astHash != null && message.hasOwnProperty("astHash"))
                if (!$util.isString(message.astHash))
                    return "astHash: string expected";
            if (message.signature != null && message.hasOwnProperty("signature"))
                if (!$util.isString(message.signature))
                    return "signature: string expected";
            return null;
        };

        /**
         * Creates an ImpactEvent message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega64.ImpactEvent
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega64.ImpactEvent} ImpactEvent
         */
        ImpactEvent.fromObject = function fromObject(object) {
            if (object instanceof $root.omega64.ImpactEvent)
                return object;
            let message = new $root.omega64.ImpactEvent();
            if (object.target != null) {
                if (typeof object.target !== "object")
                    throw TypeError(".omega64.ImpactEvent.target: object expected");
                message.target = $root.omega64.UniversalCoordinate.fromObject(object.target);
            }
            if (object.energy != null)
                message.energy = Number(object.energy);
            if (object.astHash != null)
                message.astHash = String(object.astHash);
            if (object.signature != null)
                message.signature = String(object.signature);
            return message;
        };

        /**
         * Creates a plain object from an ImpactEvent message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega64.ImpactEvent
         * @static
         * @param {omega64.ImpactEvent} message ImpactEvent
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ImpactEvent.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.target = null;
                object.energy = 0;
                object.astHash = "";
                object.signature = "";
            }
            if (message.target != null && message.hasOwnProperty("target"))
                object.target = $root.omega64.UniversalCoordinate.toObject(message.target, options);
            if (message.energy != null && message.hasOwnProperty("energy"))
                object.energy = options.json && !isFinite(message.energy) ? String(message.energy) : message.energy;
            if (message.astHash != null && message.hasOwnProperty("astHash"))
                object.astHash = message.astHash;
            if (message.signature != null && message.hasOwnProperty("signature"))
                object.signature = message.signature;
            return object;
        };

        /**
         * Converts this ImpactEvent to JSON.
         * @function toJSON
         * @memberof omega64.ImpactEvent
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ImpactEvent.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ImpactEvent
         * @function getTypeUrl
         * @memberof omega64.ImpactEvent
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ImpactEvent.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega64.ImpactEvent";
        };

        return ImpactEvent;
    })();

    omega64.SP1Receipt = (function() {

        /**
         * Properties of a SP1Receipt.
         * @memberof omega64
         * @interface ISP1Receipt
         * @property {string|null} [verifyingKey] SP1Receipt verifyingKey
         * @property {string|null} [proofBytes] SP1Receipt proofBytes
         * @property {string|null} [publicValues] SP1Receipt publicValues
         * @property {number|null} [blockHeight] SP1Receipt blockHeight
         */

        /**
         * Constructs a new SP1Receipt.
         * @memberof omega64
         * @classdesc Represents a SP1Receipt.
         * @implements ISP1Receipt
         * @constructor
         * @param {omega64.ISP1Receipt=} [properties] Properties to set
         */
        function SP1Receipt(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SP1Receipt verifyingKey.
         * @member {string} verifyingKey
         * @memberof omega64.SP1Receipt
         * @instance
         */
        SP1Receipt.prototype.verifyingKey = "";

        /**
         * SP1Receipt proofBytes.
         * @member {string} proofBytes
         * @memberof omega64.SP1Receipt
         * @instance
         */
        SP1Receipt.prototype.proofBytes = "";

        /**
         * SP1Receipt publicValues.
         * @member {string} publicValues
         * @memberof omega64.SP1Receipt
         * @instance
         */
        SP1Receipt.prototype.publicValues = "";

        /**
         * SP1Receipt blockHeight.
         * @member {number} blockHeight
         * @memberof omega64.SP1Receipt
         * @instance
         */
        SP1Receipt.prototype.blockHeight = 0;

        /**
         * Creates a new SP1Receipt instance using the specified properties.
         * @function create
         * @memberof omega64.SP1Receipt
         * @static
         * @param {omega64.ISP1Receipt=} [properties] Properties to set
         * @returns {omega64.SP1Receipt} SP1Receipt instance
         */
        SP1Receipt.create = function create(properties) {
            return new SP1Receipt(properties);
        };

        /**
         * Encodes the specified SP1Receipt message. Does not implicitly {@link omega64.SP1Receipt.verify|verify} messages.
         * @function encode
         * @memberof omega64.SP1Receipt
         * @static
         * @param {omega64.ISP1Receipt} message SP1Receipt message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SP1Receipt.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.verifyingKey != null && Object.hasOwnProperty.call(message, "verifyingKey"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.verifyingKey);
            if (message.proofBytes != null && Object.hasOwnProperty.call(message, "proofBytes"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.proofBytes);
            if (message.publicValues != null && Object.hasOwnProperty.call(message, "publicValues"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.publicValues);
            if (message.blockHeight != null && Object.hasOwnProperty.call(message, "blockHeight"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.blockHeight);
            return writer;
        };

        /**
         * Encodes the specified SP1Receipt message, length delimited. Does not implicitly {@link omega64.SP1Receipt.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega64.SP1Receipt
         * @static
         * @param {omega64.ISP1Receipt} message SP1Receipt message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SP1Receipt.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SP1Receipt message from the specified reader or buffer.
         * @function decode
         * @memberof omega64.SP1Receipt
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega64.SP1Receipt} SP1Receipt
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SP1Receipt.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega64.SP1Receipt();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.verifyingKey = reader.string();
                        break;
                    }
                case 2: {
                        message.proofBytes = reader.string();
                        break;
                    }
                case 3: {
                        message.publicValues = reader.string();
                        break;
                    }
                case 4: {
                        message.blockHeight = reader.uint32();
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
         * Decodes a SP1Receipt message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega64.SP1Receipt
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega64.SP1Receipt} SP1Receipt
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SP1Receipt.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SP1Receipt message.
         * @function verify
         * @memberof omega64.SP1Receipt
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SP1Receipt.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.verifyingKey != null && message.hasOwnProperty("verifyingKey"))
                if (!$util.isString(message.verifyingKey))
                    return "verifyingKey: string expected";
            if (message.proofBytes != null && message.hasOwnProperty("proofBytes"))
                if (!$util.isString(message.proofBytes))
                    return "proofBytes: string expected";
            if (message.publicValues != null && message.hasOwnProperty("publicValues"))
                if (!$util.isString(message.publicValues))
                    return "publicValues: string expected";
            if (message.blockHeight != null && message.hasOwnProperty("blockHeight"))
                if (!$util.isInteger(message.blockHeight))
                    return "blockHeight: integer expected";
            return null;
        };

        /**
         * Creates a SP1Receipt message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega64.SP1Receipt
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega64.SP1Receipt} SP1Receipt
         */
        SP1Receipt.fromObject = function fromObject(object) {
            if (object instanceof $root.omega64.SP1Receipt)
                return object;
            let message = new $root.omega64.SP1Receipt();
            if (object.verifyingKey != null)
                message.verifyingKey = String(object.verifyingKey);
            if (object.proofBytes != null)
                message.proofBytes = String(object.proofBytes);
            if (object.publicValues != null)
                message.publicValues = String(object.publicValues);
            if (object.blockHeight != null)
                message.blockHeight = object.blockHeight >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a SP1Receipt message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega64.SP1Receipt
         * @static
         * @param {omega64.SP1Receipt} message SP1Receipt
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SP1Receipt.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.verifyingKey = "";
                object.proofBytes = "";
                object.publicValues = "";
                object.blockHeight = 0;
            }
            if (message.verifyingKey != null && message.hasOwnProperty("verifyingKey"))
                object.verifyingKey = message.verifyingKey;
            if (message.proofBytes != null && message.hasOwnProperty("proofBytes"))
                object.proofBytes = message.proofBytes;
            if (message.publicValues != null && message.hasOwnProperty("publicValues"))
                object.publicValues = message.publicValues;
            if (message.blockHeight != null && message.hasOwnProperty("blockHeight"))
                object.blockHeight = message.blockHeight;
            return object;
        };

        /**
         * Converts this SP1Receipt to JSON.
         * @function toJSON
         * @memberof omega64.SP1Receipt
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SP1Receipt.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SP1Receipt
         * @function getTypeUrl
         * @memberof omega64.SP1Receipt
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SP1Receipt.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega64.SP1Receipt";
        };

        return SP1Receipt;
    })();

    omega64.OracleTelemetry = (function() {

        /**
         * Properties of an OracleTelemetry.
         * @memberof omega64
         * @interface IOracleTelemetry
         * @property {number|null} [entropy] OracleTelemetry entropy
         * @property {number|null} [resonance] OracleTelemetry resonance
         * @property {number|null} [globalEnergy] OracleTelemetry globalEnergy
         * @property {string|null} [climate] OracleTelemetry climate
         * @property {number|null} [queueSize] OracleTelemetry queueSize
         * @property {number|null} [nomosVerified] OracleTelemetry nomosVerified
         * @property {number|null} [nomosOrphaned] OracleTelemetry nomosOrphaned
         * @property {Array.<omega64.OracleTelemetry.IApexPlasmid>|null} [apexPlasmids] OracleTelemetry apexPlasmids
         * @property {number|null} [currentTau] OracleTelemetry currentTau
         */

        /**
         * Constructs a new OracleTelemetry.
         * @memberof omega64
         * @classdesc Represents an OracleTelemetry.
         * @implements IOracleTelemetry
         * @constructor
         * @param {omega64.IOracleTelemetry=} [properties] Properties to set
         */
        function OracleTelemetry(properties) {
            this.apexPlasmids = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * OracleTelemetry entropy.
         * @member {number} entropy
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.entropy = 0;

        /**
         * OracleTelemetry resonance.
         * @member {number} resonance
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.resonance = 0;

        /**
         * OracleTelemetry globalEnergy.
         * @member {number} globalEnergy
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.globalEnergy = 0;

        /**
         * OracleTelemetry climate.
         * @member {string} climate
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.climate = "";

        /**
         * OracleTelemetry queueSize.
         * @member {number} queueSize
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.queueSize = 0;

        /**
         * OracleTelemetry nomosVerified.
         * @member {number} nomosVerified
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.nomosVerified = 0;

        /**
         * OracleTelemetry nomosOrphaned.
         * @member {number} nomosOrphaned
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.nomosOrphaned = 0;

        /**
         * OracleTelemetry apexPlasmids.
         * @member {Array.<omega64.OracleTelemetry.IApexPlasmid>} apexPlasmids
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.apexPlasmids = $util.emptyArray;

        /**
         * OracleTelemetry currentTau.
         * @member {number} currentTau
         * @memberof omega64.OracleTelemetry
         * @instance
         */
        OracleTelemetry.prototype.currentTau = 0;

        /**
         * Creates a new OracleTelemetry instance using the specified properties.
         * @function create
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {omega64.IOracleTelemetry=} [properties] Properties to set
         * @returns {omega64.OracleTelemetry} OracleTelemetry instance
         */
        OracleTelemetry.create = function create(properties) {
            return new OracleTelemetry(properties);
        };

        /**
         * Encodes the specified OracleTelemetry message. Does not implicitly {@link omega64.OracleTelemetry.verify|verify} messages.
         * @function encode
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {omega64.IOracleTelemetry} message OracleTelemetry message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        OracleTelemetry.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.entropy != null && Object.hasOwnProperty.call(message, "entropy"))
                writer.uint32(/* id 1, wireType 5 =*/13).float(message.entropy);
            if (message.resonance != null && Object.hasOwnProperty.call(message, "resonance"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.resonance);
            if (message.globalEnergy != null && Object.hasOwnProperty.call(message, "globalEnergy"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.globalEnergy);
            if (message.climate != null && Object.hasOwnProperty.call(message, "climate"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.climate);
            if (message.queueSize != null && Object.hasOwnProperty.call(message, "queueSize"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.queueSize);
            if (message.nomosVerified != null && Object.hasOwnProperty.call(message, "nomosVerified"))
                writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.nomosVerified);
            if (message.nomosOrphaned != null && Object.hasOwnProperty.call(message, "nomosOrphaned"))
                writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.nomosOrphaned);
            if (message.apexPlasmids != null && message.apexPlasmids.length)
                for (let i = 0; i < message.apexPlasmids.length; ++i)
                    $root.omega64.OracleTelemetry.ApexPlasmid.encode(message.apexPlasmids[i], writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
            if (message.currentTau != null && Object.hasOwnProperty.call(message, "currentTau"))
                writer.uint32(/* id 9, wireType 0 =*/72).uint32(message.currentTau);
            return writer;
        };

        /**
         * Encodes the specified OracleTelemetry message, length delimited. Does not implicitly {@link omega64.OracleTelemetry.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {omega64.IOracleTelemetry} message OracleTelemetry message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        OracleTelemetry.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an OracleTelemetry message from the specified reader or buffer.
         * @function decode
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega64.OracleTelemetry} OracleTelemetry
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        OracleTelemetry.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega64.OracleTelemetry();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.entropy = reader.float();
                        break;
                    }
                case 2: {
                        message.resonance = reader.float();
                        break;
                    }
                case 3: {
                        message.globalEnergy = reader.float();
                        break;
                    }
                case 4: {
                        message.climate = reader.string();
                        break;
                    }
                case 5: {
                        message.queueSize = reader.uint32();
                        break;
                    }
                case 6: {
                        message.nomosVerified = reader.uint32();
                        break;
                    }
                case 7: {
                        message.nomosOrphaned = reader.uint32();
                        break;
                    }
                case 8: {
                        if (!(message.apexPlasmids && message.apexPlasmids.length))
                            message.apexPlasmids = [];
                        message.apexPlasmids.push($root.omega64.OracleTelemetry.ApexPlasmid.decode(reader, reader.uint32()));
                        break;
                    }
                case 9: {
                        message.currentTau = reader.uint32();
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
         * Decodes an OracleTelemetry message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega64.OracleTelemetry} OracleTelemetry
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        OracleTelemetry.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an OracleTelemetry message.
         * @function verify
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        OracleTelemetry.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.entropy != null && message.hasOwnProperty("entropy"))
                if (typeof message.entropy !== "number")
                    return "entropy: number expected";
            if (message.resonance != null && message.hasOwnProperty("resonance"))
                if (typeof message.resonance !== "number")
                    return "resonance: number expected";
            if (message.globalEnergy != null && message.hasOwnProperty("globalEnergy"))
                if (typeof message.globalEnergy !== "number")
                    return "globalEnergy: number expected";
            if (message.climate != null && message.hasOwnProperty("climate"))
                if (!$util.isString(message.climate))
                    return "climate: string expected";
            if (message.queueSize != null && message.hasOwnProperty("queueSize"))
                if (!$util.isInteger(message.queueSize))
                    return "queueSize: integer expected";
            if (message.nomosVerified != null && message.hasOwnProperty("nomosVerified"))
                if (!$util.isInteger(message.nomosVerified))
                    return "nomosVerified: integer expected";
            if (message.nomosOrphaned != null && message.hasOwnProperty("nomosOrphaned"))
                if (!$util.isInteger(message.nomosOrphaned))
                    return "nomosOrphaned: integer expected";
            if (message.apexPlasmids != null && message.hasOwnProperty("apexPlasmids")) {
                if (!Array.isArray(message.apexPlasmids))
                    return "apexPlasmids: array expected";
                for (let i = 0; i < message.apexPlasmids.length; ++i) {
                    let error = $root.omega64.OracleTelemetry.ApexPlasmid.verify(message.apexPlasmids[i]);
                    if (error)
                        return "apexPlasmids." + error;
                }
            }
            if (message.currentTau != null && message.hasOwnProperty("currentTau"))
                if (!$util.isInteger(message.currentTau))
                    return "currentTau: integer expected";
            return null;
        };

        /**
         * Creates an OracleTelemetry message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega64.OracleTelemetry} OracleTelemetry
         */
        OracleTelemetry.fromObject = function fromObject(object) {
            if (object instanceof $root.omega64.OracleTelemetry)
                return object;
            let message = new $root.omega64.OracleTelemetry();
            if (object.entropy != null)
                message.entropy = Number(object.entropy);
            if (object.resonance != null)
                message.resonance = Number(object.resonance);
            if (object.globalEnergy != null)
                message.globalEnergy = Number(object.globalEnergy);
            if (object.climate != null)
                message.climate = String(object.climate);
            if (object.queueSize != null)
                message.queueSize = object.queueSize >>> 0;
            if (object.nomosVerified != null)
                message.nomosVerified = object.nomosVerified >>> 0;
            if (object.nomosOrphaned != null)
                message.nomosOrphaned = object.nomosOrphaned >>> 0;
            if (object.apexPlasmids) {
                if (!Array.isArray(object.apexPlasmids))
                    throw TypeError(".omega64.OracleTelemetry.apexPlasmids: array expected");
                message.apexPlasmids = [];
                for (let i = 0; i < object.apexPlasmids.length; ++i) {
                    if (typeof object.apexPlasmids[i] !== "object")
                        throw TypeError(".omega64.OracleTelemetry.apexPlasmids: object expected");
                    message.apexPlasmids[i] = $root.omega64.OracleTelemetry.ApexPlasmid.fromObject(object.apexPlasmids[i]);
                }
            }
            if (object.currentTau != null)
                message.currentTau = object.currentTau >>> 0;
            return message;
        };

        /**
         * Creates a plain object from an OracleTelemetry message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {omega64.OracleTelemetry} message OracleTelemetry
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        OracleTelemetry.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.apexPlasmids = [];
            if (options.defaults) {
                object.entropy = 0;
                object.resonance = 0;
                object.globalEnergy = 0;
                object.climate = "";
                object.queueSize = 0;
                object.nomosVerified = 0;
                object.nomosOrphaned = 0;
                object.currentTau = 0;
            }
            if (message.entropy != null && message.hasOwnProperty("entropy"))
                object.entropy = options.json && !isFinite(message.entropy) ? String(message.entropy) : message.entropy;
            if (message.resonance != null && message.hasOwnProperty("resonance"))
                object.resonance = options.json && !isFinite(message.resonance) ? String(message.resonance) : message.resonance;
            if (message.globalEnergy != null && message.hasOwnProperty("globalEnergy"))
                object.globalEnergy = options.json && !isFinite(message.globalEnergy) ? String(message.globalEnergy) : message.globalEnergy;
            if (message.climate != null && message.hasOwnProperty("climate"))
                object.climate = message.climate;
            if (message.queueSize != null && message.hasOwnProperty("queueSize"))
                object.queueSize = message.queueSize;
            if (message.nomosVerified != null && message.hasOwnProperty("nomosVerified"))
                object.nomosVerified = message.nomosVerified;
            if (message.nomosOrphaned != null && message.hasOwnProperty("nomosOrphaned"))
                object.nomosOrphaned = message.nomosOrphaned;
            if (message.apexPlasmids && message.apexPlasmids.length) {
                object.apexPlasmids = [];
                for (let j = 0; j < message.apexPlasmids.length; ++j)
                    object.apexPlasmids[j] = $root.omega64.OracleTelemetry.ApexPlasmid.toObject(message.apexPlasmids[j], options);
            }
            if (message.currentTau != null && message.hasOwnProperty("currentTau"))
                object.currentTau = message.currentTau;
            return object;
        };

        /**
         * Converts this OracleTelemetry to JSON.
         * @function toJSON
         * @memberof omega64.OracleTelemetry
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        OracleTelemetry.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for OracleTelemetry
         * @function getTypeUrl
         * @memberof omega64.OracleTelemetry
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        OracleTelemetry.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega64.OracleTelemetry";
        };

        OracleTelemetry.ApexPlasmid = (function() {

            /**
             * Properties of an ApexPlasmid.
             * @memberof omega64.OracleTelemetry
             * @interface IApexPlasmid
             * @property {string|null} [hash] ApexPlasmid hash
             * @property {string|null} [astStr] ApexPlasmid astStr
             * @property {number|null} [energy] ApexPlasmid energy
             */

            /**
             * Constructs a new ApexPlasmid.
             * @memberof omega64.OracleTelemetry
             * @classdesc Represents an ApexPlasmid.
             * @implements IApexPlasmid
             * @constructor
             * @param {omega64.OracleTelemetry.IApexPlasmid=} [properties] Properties to set
             */
            function ApexPlasmid(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * ApexPlasmid hash.
             * @member {string} hash
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @instance
             */
            ApexPlasmid.prototype.hash = "";

            /**
             * ApexPlasmid astStr.
             * @member {string} astStr
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @instance
             */
            ApexPlasmid.prototype.astStr = "";

            /**
             * ApexPlasmid energy.
             * @member {number} energy
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @instance
             */
            ApexPlasmid.prototype.energy = 0;

            /**
             * Creates a new ApexPlasmid instance using the specified properties.
             * @function create
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {omega64.OracleTelemetry.IApexPlasmid=} [properties] Properties to set
             * @returns {omega64.OracleTelemetry.ApexPlasmid} ApexPlasmid instance
             */
            ApexPlasmid.create = function create(properties) {
                return new ApexPlasmid(properties);
            };

            /**
             * Encodes the specified ApexPlasmid message. Does not implicitly {@link omega64.OracleTelemetry.ApexPlasmid.verify|verify} messages.
             * @function encode
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {omega64.OracleTelemetry.IApexPlasmid} message ApexPlasmid message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ApexPlasmid.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.hash);
                if (message.astStr != null && Object.hasOwnProperty.call(message, "astStr"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.astStr);
                if (message.energy != null && Object.hasOwnProperty.call(message, "energy"))
                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.energy);
                return writer;
            };

            /**
             * Encodes the specified ApexPlasmid message, length delimited. Does not implicitly {@link omega64.OracleTelemetry.ApexPlasmid.verify|verify} messages.
             * @function encodeDelimited
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {omega64.OracleTelemetry.IApexPlasmid} message ApexPlasmid message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ApexPlasmid.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an ApexPlasmid message from the specified reader or buffer.
             * @function decode
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {omega64.OracleTelemetry.ApexPlasmid} ApexPlasmid
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ApexPlasmid.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega64.OracleTelemetry.ApexPlasmid();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.hash = reader.string();
                            break;
                        }
                    case 2: {
                            message.astStr = reader.string();
                            break;
                        }
                    case 3: {
                            message.energy = reader.uint32();
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
             * Decodes an ApexPlasmid message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {omega64.OracleTelemetry.ApexPlasmid} ApexPlasmid
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ApexPlasmid.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an ApexPlasmid message.
             * @function verify
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            ApexPlasmid.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.hash != null && message.hasOwnProperty("hash"))
                    if (!$util.isString(message.hash))
                        return "hash: string expected";
                if (message.astStr != null && message.hasOwnProperty("astStr"))
                    if (!$util.isString(message.astStr))
                        return "astStr: string expected";
                if (message.energy != null && message.hasOwnProperty("energy"))
                    if (!$util.isInteger(message.energy))
                        return "energy: integer expected";
                return null;
            };

            /**
             * Creates an ApexPlasmid message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {omega64.OracleTelemetry.ApexPlasmid} ApexPlasmid
             */
            ApexPlasmid.fromObject = function fromObject(object) {
                if (object instanceof $root.omega64.OracleTelemetry.ApexPlasmid)
                    return object;
                let message = new $root.omega64.OracleTelemetry.ApexPlasmid();
                if (object.hash != null)
                    message.hash = String(object.hash);
                if (object.astStr != null)
                    message.astStr = String(object.astStr);
                if (object.energy != null)
                    message.energy = object.energy >>> 0;
                return message;
            };

            /**
             * Creates a plain object from an ApexPlasmid message. Also converts values to other types if specified.
             * @function toObject
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {omega64.OracleTelemetry.ApexPlasmid} message ApexPlasmid
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            ApexPlasmid.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.hash = "";
                    object.astStr = "";
                    object.energy = 0;
                }
                if (message.hash != null && message.hasOwnProperty("hash"))
                    object.hash = message.hash;
                if (message.astStr != null && message.hasOwnProperty("astStr"))
                    object.astStr = message.astStr;
                if (message.energy != null && message.hasOwnProperty("energy"))
                    object.energy = message.energy;
                return object;
            };

            /**
             * Converts this ApexPlasmid to JSON.
             * @function toJSON
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            ApexPlasmid.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for ApexPlasmid
             * @function getTypeUrl
             * @memberof omega64.OracleTelemetry.ApexPlasmid
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            ApexPlasmid.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/omega64.OracleTelemetry.ApexPlasmid";
            };

            return ApexPlasmid;
        })();

        return OracleTelemetry;
    })();

    omega64.OmegaMessage = (function() {

        /**
         * Properties of an OmegaMessage.
         * @memberof omega64
         * @interface IOmegaMessage
         * @property {omega64.OmegaMessage.MessageType|null} [type] OmegaMessage type
         * @property {omega64.IForeignPlasmid|null} [plasmid] OmegaMessage plasmid
         * @property {omega64.IImpactEvent|null} [impact] OmegaMessage impact
         * @property {omega64.IOracleTelemetry|null} [telemetry] OmegaMessage telemetry
         * @property {omega64.ISP1Receipt|null} [zkReceipt] OmegaMessage zkReceipt
         */

        /**
         * Constructs a new OmegaMessage.
         * @memberof omega64
         * @classdesc Represents an OmegaMessage.
         * @implements IOmegaMessage
         * @constructor
         * @param {omega64.IOmegaMessage=} [properties] Properties to set
         */
        function OmegaMessage(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * OmegaMessage type.
         * @member {omega64.OmegaMessage.MessageType} type
         * @memberof omega64.OmegaMessage
         * @instance
         */
        OmegaMessage.prototype.type = 0;

        /**
         * OmegaMessage plasmid.
         * @member {omega64.IForeignPlasmid|null|undefined} plasmid
         * @memberof omega64.OmegaMessage
         * @instance
         */
        OmegaMessage.prototype.plasmid = null;

        /**
         * OmegaMessage impact.
         * @member {omega64.IImpactEvent|null|undefined} impact
         * @memberof omega64.OmegaMessage
         * @instance
         */
        OmegaMessage.prototype.impact = null;

        /**
         * OmegaMessage telemetry.
         * @member {omega64.IOracleTelemetry|null|undefined} telemetry
         * @memberof omega64.OmegaMessage
         * @instance
         */
        OmegaMessage.prototype.telemetry = null;

        /**
         * OmegaMessage zkReceipt.
         * @member {omega64.ISP1Receipt|null|undefined} zkReceipt
         * @memberof omega64.OmegaMessage
         * @instance
         */
        OmegaMessage.prototype.zkReceipt = null;

        /**
         * Creates a new OmegaMessage instance using the specified properties.
         * @function create
         * @memberof omega64.OmegaMessage
         * @static
         * @param {omega64.IOmegaMessage=} [properties] Properties to set
         * @returns {omega64.OmegaMessage} OmegaMessage instance
         */
        OmegaMessage.create = function create(properties) {
            return new OmegaMessage(properties);
        };

        /**
         * Encodes the specified OmegaMessage message. Does not implicitly {@link omega64.OmegaMessage.verify|verify} messages.
         * @function encode
         * @memberof omega64.OmegaMessage
         * @static
         * @param {omega64.IOmegaMessage} message OmegaMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        OmegaMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.type);
            if (message.plasmid != null && Object.hasOwnProperty.call(message, "plasmid"))
                $root.omega64.ForeignPlasmid.encode(message.plasmid, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.impact != null && Object.hasOwnProperty.call(message, "impact"))
                $root.omega64.ImpactEvent.encode(message.impact, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.telemetry != null && Object.hasOwnProperty.call(message, "telemetry"))
                $root.omega64.OracleTelemetry.encode(message.telemetry, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.zkReceipt != null && Object.hasOwnProperty.call(message, "zkReceipt"))
                $root.omega64.SP1Receipt.encode(message.zkReceipt, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified OmegaMessage message, length delimited. Does not implicitly {@link omega64.OmegaMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof omega64.OmegaMessage
         * @static
         * @param {omega64.IOmegaMessage} message OmegaMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        OmegaMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an OmegaMessage message from the specified reader or buffer.
         * @function decode
         * @memberof omega64.OmegaMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {omega64.OmegaMessage} OmegaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        OmegaMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.omega64.OmegaMessage();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.type = reader.int32();
                        break;
                    }
                case 2: {
                        message.plasmid = $root.omega64.ForeignPlasmid.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.impact = $root.omega64.ImpactEvent.decode(reader, reader.uint32());
                        break;
                    }
                case 4: {
                        message.telemetry = $root.omega64.OracleTelemetry.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        message.zkReceipt = $root.omega64.SP1Receipt.decode(reader, reader.uint32());
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
         * Decodes an OmegaMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof omega64.OmegaMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {omega64.OmegaMessage} OmegaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        OmegaMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an OmegaMessage message.
         * @function verify
         * @memberof omega64.OmegaMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        OmegaMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.type != null && message.hasOwnProperty("type"))
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                    break;
                }
            if (message.plasmid != null && message.hasOwnProperty("plasmid")) {
                let error = $root.omega64.ForeignPlasmid.verify(message.plasmid);
                if (error)
                    return "plasmid." + error;
            }
            if (message.impact != null && message.hasOwnProperty("impact")) {
                let error = $root.omega64.ImpactEvent.verify(message.impact);
                if (error)
                    return "impact." + error;
            }
            if (message.telemetry != null && message.hasOwnProperty("telemetry")) {
                let error = $root.omega64.OracleTelemetry.verify(message.telemetry);
                if (error)
                    return "telemetry." + error;
            }
            if (message.zkReceipt != null && message.hasOwnProperty("zkReceipt")) {
                let error = $root.omega64.SP1Receipt.verify(message.zkReceipt);
                if (error)
                    return "zkReceipt." + error;
            }
            return null;
        };

        /**
         * Creates an OmegaMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof omega64.OmegaMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {omega64.OmegaMessage} OmegaMessage
         */
        OmegaMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.omega64.OmegaMessage)
                return object;
            let message = new $root.omega64.OmegaMessage();
            switch (object.type) {
            default:
                if (typeof object.type === "number") {
                    message.type = object.type;
                    break;
                }
                break;
            case "UNKNOWN":
            case 0:
                message.type = 0;
                break;
            case "FOREIGN_PLASMID":
            case 1:
                message.type = 1;
                break;
            case "IMPACT_EVENT":
            case 2:
                message.type = 2;
                break;
            case "SYNC_METADATA":
            case 3:
                message.type = 3;
                break;
            }
            if (object.plasmid != null) {
                if (typeof object.plasmid !== "object")
                    throw TypeError(".omega64.OmegaMessage.plasmid: object expected");
                message.plasmid = $root.omega64.ForeignPlasmid.fromObject(object.plasmid);
            }
            if (object.impact != null) {
                if (typeof object.impact !== "object")
                    throw TypeError(".omega64.OmegaMessage.impact: object expected");
                message.impact = $root.omega64.ImpactEvent.fromObject(object.impact);
            }
            if (object.telemetry != null) {
                if (typeof object.telemetry !== "object")
                    throw TypeError(".omega64.OmegaMessage.telemetry: object expected");
                message.telemetry = $root.omega64.OracleTelemetry.fromObject(object.telemetry);
            }
            if (object.zkReceipt != null) {
                if (typeof object.zkReceipt !== "object")
                    throw TypeError(".omega64.OmegaMessage.zkReceipt: object expected");
                message.zkReceipt = $root.omega64.SP1Receipt.fromObject(object.zkReceipt);
            }
            return message;
        };

        /**
         * Creates a plain object from an OmegaMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof omega64.OmegaMessage
         * @static
         * @param {omega64.OmegaMessage} message OmegaMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        OmegaMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.type = options.enums === String ? "UNKNOWN" : 0;
                object.plasmid = null;
                object.impact = null;
                object.telemetry = null;
                object.zkReceipt = null;
            }
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = options.enums === String ? $root.omega64.OmegaMessage.MessageType[message.type] === undefined ? message.type : $root.omega64.OmegaMessage.MessageType[message.type] : message.type;
            if (message.plasmid != null && message.hasOwnProperty("plasmid"))
                object.plasmid = $root.omega64.ForeignPlasmid.toObject(message.plasmid, options);
            if (message.impact != null && message.hasOwnProperty("impact"))
                object.impact = $root.omega64.ImpactEvent.toObject(message.impact, options);
            if (message.telemetry != null && message.hasOwnProperty("telemetry"))
                object.telemetry = $root.omega64.OracleTelemetry.toObject(message.telemetry, options);
            if (message.zkReceipt != null && message.hasOwnProperty("zkReceipt"))
                object.zkReceipt = $root.omega64.SP1Receipt.toObject(message.zkReceipt, options);
            return object;
        };

        /**
         * Converts this OmegaMessage to JSON.
         * @function toJSON
         * @memberof omega64.OmegaMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        OmegaMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for OmegaMessage
         * @function getTypeUrl
         * @memberof omega64.OmegaMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        OmegaMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/omega64.OmegaMessage";
        };

        /**
         * MessageType enum.
         * @name omega64.OmegaMessage.MessageType
         * @enum {number}
         * @property {number} UNKNOWN=0 UNKNOWN value
         * @property {number} FOREIGN_PLASMID=1 FOREIGN_PLASMID value
         * @property {number} IMPACT_EVENT=2 IMPACT_EVENT value
         * @property {number} SYNC_METADATA=3 SYNC_METADATA value
         */
        OmegaMessage.MessageType = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "UNKNOWN"] = 0;
            values[valuesById[1] = "FOREIGN_PLASMID"] = 1;
            values[valuesById[2] = "IMPACT_EVENT"] = 2;
            values[valuesById[3] = "SYNC_METADATA"] = 3;
            return values;
        })();

        return OmegaMessage;
    })();

    return omega64;
})();

export { $root as default };
