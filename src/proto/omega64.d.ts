import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace omega64. */
export namespace omega64 {

    /** Properties of a NetworkPhenotype. */
    interface INetworkPhenotype {

        /** NetworkPhenotype behavior */
        behavior?: (string|null);

        /** NetworkPhenotype latency */
        latency?: (number|null);

        /** NetworkPhenotype replicationCost */
        replicationCost?: (number|null);

        /** NetworkPhenotype networkSignature */
        networkSignature?: (string|null);

        /** NetworkPhenotype targetAlignment */
        targetAlignment?: (string|null);
    }

    /** Represents a NetworkPhenotype. */
    class NetworkPhenotype implements INetworkPhenotype {

        /**
         * Constructs a new NetworkPhenotype.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega64.INetworkPhenotype);

        /** NetworkPhenotype behavior. */
        public behavior: string;

        /** NetworkPhenotype latency. */
        public latency: number;

        /** NetworkPhenotype replicationCost. */
        public replicationCost: number;

        /** NetworkPhenotype networkSignature. */
        public networkSignature: string;

        /** NetworkPhenotype targetAlignment. */
        public targetAlignment: string;

        /**
         * Creates a new NetworkPhenotype instance using the specified properties.
         * @param [properties] Properties to set
         * @returns NetworkPhenotype instance
         */
        public static create(properties?: omega64.INetworkPhenotype): omega64.NetworkPhenotype;

        /**
         * Encodes the specified NetworkPhenotype message. Does not implicitly {@link omega64.NetworkPhenotype.verify|verify} messages.
         * @param message NetworkPhenotype message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega64.INetworkPhenotype, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified NetworkPhenotype message, length delimited. Does not implicitly {@link omega64.NetworkPhenotype.verify|verify} messages.
         * @param message NetworkPhenotype message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega64.INetworkPhenotype, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a NetworkPhenotype message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns NetworkPhenotype
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega64.NetworkPhenotype;

        /**
         * Decodes a NetworkPhenotype message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns NetworkPhenotype
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega64.NetworkPhenotype;

        /**
         * Verifies a NetworkPhenotype message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a NetworkPhenotype message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns NetworkPhenotype
         */
        public static fromObject(object: { [k: string]: any }): omega64.NetworkPhenotype;

        /**
         * Creates a plain object from a NetworkPhenotype message. Also converts values to other types if specified.
         * @param message NetworkPhenotype
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega64.NetworkPhenotype, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this NetworkPhenotype to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for NetworkPhenotype
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ForeignPlasmid. */
    interface IForeignPlasmid {

        /** ForeignPlasmid hash */
        hash?: (string|null);

        /** ForeignPlasmid astStr */
        astStr?: (string|null);

        /** ForeignPlasmid energy */
        energy?: (number|null);

        /** ForeignPlasmid targetBucket */
        targetBucket?: (number|null);

        /** ForeignPlasmid origin */
        origin?: (string|null);

        /** ForeignPlasmid parents */
        parents?: (string[]|null);

        /** ForeignPlasmid signature */
        signature?: (string|null);

        /** ForeignPlasmid vectorClock */
        vectorClock?: ({ [k: string]: number }|null);

        /** ForeignPlasmid phenotype */
        phenotype?: (omega64.INetworkPhenotype|null);

        /** ForeignPlasmid proofBytes */
        proofBytes?: (string|null);

        /** ForeignPlasmid morphologyHash */
        morphologyHash?: (string|null);

        /** ForeignPlasmid stepsCost */
        stepsCost?: (number|null);

        /** ForeignPlasmid burnTxHash */
        burnTxHash?: (string|null);
    }

    /** Represents a ForeignPlasmid. */
    class ForeignPlasmid implements IForeignPlasmid {

        /**
         * Constructs a new ForeignPlasmid.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega64.IForeignPlasmid);

        /** ForeignPlasmid hash. */
        public hash: string;

        /** ForeignPlasmid astStr. */
        public astStr: string;

        /** ForeignPlasmid energy. */
        public energy: number;

        /** ForeignPlasmid targetBucket. */
        public targetBucket: number;

        /** ForeignPlasmid origin. */
        public origin: string;

        /** ForeignPlasmid parents. */
        public parents: string[];

        /** ForeignPlasmid signature. */
        public signature: string;

        /** ForeignPlasmid vectorClock. */
        public vectorClock: { [k: string]: number };

        /** ForeignPlasmid phenotype. */
        public phenotype?: (omega64.INetworkPhenotype|null);

        /** ForeignPlasmid proofBytes. */
        public proofBytes: string;

        /** ForeignPlasmid morphologyHash. */
        public morphologyHash: string;

        /** ForeignPlasmid stepsCost. */
        public stepsCost: number;

        /** ForeignPlasmid burnTxHash. */
        public burnTxHash: string;

        /**
         * Creates a new ForeignPlasmid instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ForeignPlasmid instance
         */
        public static create(properties?: omega64.IForeignPlasmid): omega64.ForeignPlasmid;

        /**
         * Encodes the specified ForeignPlasmid message. Does not implicitly {@link omega64.ForeignPlasmid.verify|verify} messages.
         * @param message ForeignPlasmid message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega64.IForeignPlasmid, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ForeignPlasmid message, length delimited. Does not implicitly {@link omega64.ForeignPlasmid.verify|verify} messages.
         * @param message ForeignPlasmid message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega64.IForeignPlasmid, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ForeignPlasmid message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ForeignPlasmid
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega64.ForeignPlasmid;

        /**
         * Decodes a ForeignPlasmid message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ForeignPlasmid
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega64.ForeignPlasmid;

        /**
         * Verifies a ForeignPlasmid message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ForeignPlasmid message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ForeignPlasmid
         */
        public static fromObject(object: { [k: string]: any }): omega64.ForeignPlasmid;

        /**
         * Creates a plain object from a ForeignPlasmid message. Also converts values to other types if specified.
         * @param message ForeignPlasmid
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega64.ForeignPlasmid, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ForeignPlasmid to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ForeignPlasmid
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a HaloSync. */
    interface IHaloSync {

        /** HaloSync left */
        left?: (Uint8Array|null);

        /** HaloSync right */
        right?: (Uint8Array|null);
    }

    /** Represents a HaloSync. */
    class HaloSync implements IHaloSync {

        /**
         * Constructs a new HaloSync.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega64.IHaloSync);

        /** HaloSync left. */
        public left: Uint8Array;

        /** HaloSync right. */
        public right: Uint8Array;

        /**
         * Creates a new HaloSync instance using the specified properties.
         * @param [properties] Properties to set
         * @returns HaloSync instance
         */
        public static create(properties?: omega64.IHaloSync): omega64.HaloSync;

        /**
         * Encodes the specified HaloSync message. Does not implicitly {@link omega64.HaloSync.verify|verify} messages.
         * @param message HaloSync message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega64.IHaloSync, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified HaloSync message, length delimited. Does not implicitly {@link omega64.HaloSync.verify|verify} messages.
         * @param message HaloSync message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega64.IHaloSync, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a HaloSync message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns HaloSync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega64.HaloSync;

        /**
         * Decodes a HaloSync message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns HaloSync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega64.HaloSync;

        /**
         * Verifies a HaloSync message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a HaloSync message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns HaloSync
         */
        public static fromObject(object: { [k: string]: any }): omega64.HaloSync;

        /**
         * Creates a plain object from a HaloSync message. Also converts values to other types if specified.
         * @param message HaloSync
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega64.HaloSync, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this HaloSync to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for HaloSync
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OracleTelemetry. */
    interface IOracleTelemetry {

        /** OracleTelemetry entropy */
        entropy?: (number|null);

        /** OracleTelemetry resonance */
        resonance?: (number|null);

        /** OracleTelemetry globalEnergy */
        globalEnergy?: (number|null);

        /** OracleTelemetry climate */
        climate?: (string|null);

        /** OracleTelemetry queueSize */
        queueSize?: (number|null);

        /** OracleTelemetry nomosVerified */
        nomosVerified?: (number|null);

        /** OracleTelemetry nomosOrphaned */
        nomosOrphaned?: (number|null);

        /** OracleTelemetry apexPlasmids */
        apexPlasmids?: (omega64.OracleTelemetry.IApexPlasmid[]|null);

        /** OracleTelemetry currentTau */
        currentTau?: (number|null);
    }

    /** Represents an OracleTelemetry. */
    class OracleTelemetry implements IOracleTelemetry {

        /**
         * Constructs a new OracleTelemetry.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega64.IOracleTelemetry);

        /** OracleTelemetry entropy. */
        public entropy: number;

        /** OracleTelemetry resonance. */
        public resonance: number;

        /** OracleTelemetry globalEnergy. */
        public globalEnergy: number;

        /** OracleTelemetry climate. */
        public climate: string;

        /** OracleTelemetry queueSize. */
        public queueSize: number;

        /** OracleTelemetry nomosVerified. */
        public nomosVerified: number;

        /** OracleTelemetry nomosOrphaned. */
        public nomosOrphaned: number;

        /** OracleTelemetry apexPlasmids. */
        public apexPlasmids: omega64.OracleTelemetry.IApexPlasmid[];

        /** OracleTelemetry currentTau. */
        public currentTau: number;

        /**
         * Creates a new OracleTelemetry instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OracleTelemetry instance
         */
        public static create(properties?: omega64.IOracleTelemetry): omega64.OracleTelemetry;

        /**
         * Encodes the specified OracleTelemetry message. Does not implicitly {@link omega64.OracleTelemetry.verify|verify} messages.
         * @param message OracleTelemetry message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega64.IOracleTelemetry, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified OracleTelemetry message, length delimited. Does not implicitly {@link omega64.OracleTelemetry.verify|verify} messages.
         * @param message OracleTelemetry message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega64.IOracleTelemetry, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an OracleTelemetry message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OracleTelemetry
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega64.OracleTelemetry;

        /**
         * Decodes an OracleTelemetry message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OracleTelemetry
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega64.OracleTelemetry;

        /**
         * Verifies an OracleTelemetry message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an OracleTelemetry message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OracleTelemetry
         */
        public static fromObject(object: { [k: string]: any }): omega64.OracleTelemetry;

        /**
         * Creates a plain object from an OracleTelemetry message. Also converts values to other types if specified.
         * @param message OracleTelemetry
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega64.OracleTelemetry, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this OracleTelemetry to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OracleTelemetry
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace OracleTelemetry {

        /** Properties of an ApexPlasmid. */
        interface IApexPlasmid {

            /** ApexPlasmid hash */
            hash?: (string|null);

            /** ApexPlasmid astStr */
            astStr?: (string|null);

            /** ApexPlasmid energy */
            energy?: (number|null);
        }

        /** Represents an ApexPlasmid. */
        class ApexPlasmid implements IApexPlasmid {

            /**
             * Constructs a new ApexPlasmid.
             * @param [properties] Properties to set
             */
            constructor(properties?: omega64.OracleTelemetry.IApexPlasmid);

            /** ApexPlasmid hash. */
            public hash: string;

            /** ApexPlasmid astStr. */
            public astStr: string;

            /** ApexPlasmid energy. */
            public energy: number;

            /**
             * Creates a new ApexPlasmid instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ApexPlasmid instance
             */
            public static create(properties?: omega64.OracleTelemetry.IApexPlasmid): omega64.OracleTelemetry.ApexPlasmid;

            /**
             * Encodes the specified ApexPlasmid message. Does not implicitly {@link omega64.OracleTelemetry.ApexPlasmid.verify|verify} messages.
             * @param message ApexPlasmid message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: omega64.OracleTelemetry.IApexPlasmid, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ApexPlasmid message, length delimited. Does not implicitly {@link omega64.OracleTelemetry.ApexPlasmid.verify|verify} messages.
             * @param message ApexPlasmid message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: omega64.OracleTelemetry.IApexPlasmid, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an ApexPlasmid message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ApexPlasmid
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega64.OracleTelemetry.ApexPlasmid;

            /**
             * Decodes an ApexPlasmid message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ApexPlasmid
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega64.OracleTelemetry.ApexPlasmid;

            /**
             * Verifies an ApexPlasmid message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an ApexPlasmid message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ApexPlasmid
             */
            public static fromObject(object: { [k: string]: any }): omega64.OracleTelemetry.ApexPlasmid;

            /**
             * Creates a plain object from an ApexPlasmid message. Also converts values to other types if specified.
             * @param message ApexPlasmid
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: omega64.OracleTelemetry.ApexPlasmid, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ApexPlasmid to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ApexPlasmid
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of an OmegaMessage. */
    interface IOmegaMessage {

        /** OmegaMessage type */
        type?: (omega64.OmegaMessage.MessageType|null);

        /** OmegaMessage plasmid */
        plasmid?: (omega64.IForeignPlasmid|null);

        /** OmegaMessage halo */
        halo?: (omega64.IHaloSync|null);

        /** OmegaMessage telemetry */
        telemetry?: (omega64.IOracleTelemetry|null);
    }

    /** Represents an OmegaMessage. */
    class OmegaMessage implements IOmegaMessage {

        /**
         * Constructs a new OmegaMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega64.IOmegaMessage);

        /** OmegaMessage type. */
        public type: omega64.OmegaMessage.MessageType;

        /** OmegaMessage plasmid. */
        public plasmid?: (omega64.IForeignPlasmid|null);

        /** OmegaMessage halo. */
        public halo?: (omega64.IHaloSync|null);

        /** OmegaMessage telemetry. */
        public telemetry?: (omega64.IOracleTelemetry|null);

        /**
         * Creates a new OmegaMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OmegaMessage instance
         */
        public static create(properties?: omega64.IOmegaMessage): omega64.OmegaMessage;

        /**
         * Encodes the specified OmegaMessage message. Does not implicitly {@link omega64.OmegaMessage.verify|verify} messages.
         * @param message OmegaMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega64.IOmegaMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified OmegaMessage message, length delimited. Does not implicitly {@link omega64.OmegaMessage.verify|verify} messages.
         * @param message OmegaMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega64.IOmegaMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an OmegaMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OmegaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega64.OmegaMessage;

        /**
         * Decodes an OmegaMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OmegaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega64.OmegaMessage;

        /**
         * Verifies an OmegaMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an OmegaMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OmegaMessage
         */
        public static fromObject(object: { [k: string]: any }): omega64.OmegaMessage;

        /**
         * Creates a plain object from an OmegaMessage message. Also converts values to other types if specified.
         * @param message OmegaMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega64.OmegaMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this OmegaMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OmegaMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace OmegaMessage {

        /** MessageType enum. */
        enum MessageType {
            UNKNOWN = 0,
            FOREIGN_PLASMID = 1,
            HALO_SYNC = 2,
            SYNC_METADATA = 3
        }
    }
}
