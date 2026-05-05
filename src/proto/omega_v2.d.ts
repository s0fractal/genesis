import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace omega_v2. */
export namespace omega_v2 {

    /** Properties of a PhaseAgentMinimal. */
    interface IPhaseAgentMinimal {

        /** PhaseAgentMinimal phase */
        phase?: (number|null);

        /** PhaseAgentMinimal energy */
        energy?: (number|null);

        /** PhaseAgentMinimal baseFreq */
        baseFreq?: (number|null);

        /** PhaseAgentMinimal stateFlags */
        stateFlags?: (number|null);

        /** PhaseAgentMinimal genome */
        genome?: (number|null);

        /** PhaseAgentMinimal memory */
        memory?: (number[]|null);
    }

    /** Represents a PhaseAgentMinimal. */
    class PhaseAgentMinimal implements IPhaseAgentMinimal {

        /**
         * Constructs a new PhaseAgentMinimal.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.IPhaseAgentMinimal);

        /** PhaseAgentMinimal phase. */
        public phase: number;

        /** PhaseAgentMinimal energy. */
        public energy: number;

        /** PhaseAgentMinimal baseFreq. */
        public baseFreq: number;

        /** PhaseAgentMinimal stateFlags. */
        public stateFlags: number;

        /** PhaseAgentMinimal genome. */
        public genome: number;

        /** PhaseAgentMinimal memory. */
        public memory: number[];

        /**
         * Creates a new PhaseAgentMinimal instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PhaseAgentMinimal instance
         */
        public static create(properties?: omega_v2.IPhaseAgentMinimal): omega_v2.PhaseAgentMinimal;

        /**
         * Encodes the specified PhaseAgentMinimal message. Does not implicitly {@link omega_v2.PhaseAgentMinimal.verify|verify} messages.
         * @param message PhaseAgentMinimal message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.IPhaseAgentMinimal, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified PhaseAgentMinimal message, length delimited. Does not implicitly {@link omega_v2.PhaseAgentMinimal.verify|verify} messages.
         * @param message PhaseAgentMinimal message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.IPhaseAgentMinimal, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a PhaseAgentMinimal message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PhaseAgentMinimal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.PhaseAgentMinimal;

        /**
         * Decodes a PhaseAgentMinimal message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PhaseAgentMinimal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.PhaseAgentMinimal;

        /**
         * Verifies a PhaseAgentMinimal message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a PhaseAgentMinimal message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PhaseAgentMinimal
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.PhaseAgentMinimal;

        /**
         * Creates a plain object from a PhaseAgentMinimal message. Also converts values to other types if specified.
         * @param message PhaseAgentMinimal
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.PhaseAgentMinimal, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this PhaseAgentMinimal to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PhaseAgentMinimal
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an AttractorMatrix. */
    interface IAttractorMatrix {

        /** AttractorMatrix state */
        state?: (number|null);
    }

    /** Represents an AttractorMatrix. */
    class AttractorMatrix implements IAttractorMatrix {

        /**
         * Constructs a new AttractorMatrix.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.IAttractorMatrix);

        /** AttractorMatrix state. */
        public state: number;

        /**
         * Creates a new AttractorMatrix instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AttractorMatrix instance
         */
        public static create(properties?: omega_v2.IAttractorMatrix): omega_v2.AttractorMatrix;

        /**
         * Encodes the specified AttractorMatrix message. Does not implicitly {@link omega_v2.AttractorMatrix.verify|verify} messages.
         * @param message AttractorMatrix message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.IAttractorMatrix, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AttractorMatrix message, length delimited. Does not implicitly {@link omega_v2.AttractorMatrix.verify|verify} messages.
         * @param message AttractorMatrix message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.IAttractorMatrix, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AttractorMatrix message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AttractorMatrix
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.AttractorMatrix;

        /**
         * Decodes an AttractorMatrix message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AttractorMatrix
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.AttractorMatrix;

        /**
         * Verifies an AttractorMatrix message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AttractorMatrix message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AttractorMatrix
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.AttractorMatrix;

        /**
         * Creates a plain object from an AttractorMatrix message. Also converts values to other types if specified.
         * @param message AttractorMatrix
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.AttractorMatrix, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AttractorMatrix to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AttractorMatrix
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an AttractorArray. */
    interface IAttractorArray {

        /** AttractorArray count */
        count?: (number|null);

        /** AttractorArray _pad */
        _pad?: (number[]|null);

        /** AttractorArray data */
        data?: (omega_v2.IAttractorMatrix[]|null);
    }

    /** Represents an AttractorArray. */
    class AttractorArray implements IAttractorArray {

        /**
         * Constructs a new AttractorArray.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.IAttractorArray);

        /** AttractorArray count. */
        public count: number;

        /** AttractorArray _pad. */
        public _pad: number[];

        /** AttractorArray data. */
        public data: omega_v2.IAttractorMatrix[];

        /**
         * Creates a new AttractorArray instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AttractorArray instance
         */
        public static create(properties?: omega_v2.IAttractorArray): omega_v2.AttractorArray;

        /**
         * Encodes the specified AttractorArray message. Does not implicitly {@link omega_v2.AttractorArray.verify|verify} messages.
         * @param message AttractorArray message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.IAttractorArray, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AttractorArray message, length delimited. Does not implicitly {@link omega_v2.AttractorArray.verify|verify} messages.
         * @param message AttractorArray message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.IAttractorArray, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AttractorArray message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AttractorArray
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.AttractorArray;

        /**
         * Decodes an AttractorArray message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AttractorArray
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.AttractorArray;

        /**
         * Verifies an AttractorArray message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AttractorArray message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AttractorArray
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.AttractorArray;

        /**
         * Creates a plain object from an AttractorArray message. Also converts values to other types if specified.
         * @param message AttractorArray
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.AttractorArray, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AttractorArray to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AttractorArray
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SignalStore. */
    interface ISignalStore {

        /** SignalStore dirtyFlags */
        dirtyFlags?: (number|null);

        /** SignalStore absoluteTick */
        absoluteTick?: (number|null);

        /** SignalStore activeAgentCount */
        activeAgentCount?: (number|null);

        /** SignalStore maxCells */
        maxCells?: (number|null);
    }

    /** Represents a SignalStore. */
    class SignalStore implements ISignalStore {

        /**
         * Constructs a new SignalStore.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.ISignalStore);

        /** SignalStore dirtyFlags. */
        public dirtyFlags: number;

        /** SignalStore absoluteTick. */
        public absoluteTick: number;

        /** SignalStore activeAgentCount. */
        public activeAgentCount: number;

        /** SignalStore maxCells. */
        public maxCells: number;

        /**
         * Creates a new SignalStore instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SignalStore instance
         */
        public static create(properties?: omega_v2.ISignalStore): omega_v2.SignalStore;

        /**
         * Encodes the specified SignalStore message. Does not implicitly {@link omega_v2.SignalStore.verify|verify} messages.
         * @param message SignalStore message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.ISignalStore, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SignalStore message, length delimited. Does not implicitly {@link omega_v2.SignalStore.verify|verify} messages.
         * @param message SignalStore message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.ISignalStore, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SignalStore message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SignalStore
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.SignalStore;

        /**
         * Decodes a SignalStore message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SignalStore
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.SignalStore;

        /**
         * Verifies a SignalStore message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SignalStore message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SignalStore
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.SignalStore;

        /**
         * Creates a plain object from a SignalStore message. Also converts values to other types if specified.
         * @param message SignalStore
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.SignalStore, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SignalStore to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SignalStore
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SporeFrame. */
    interface ISporeFrame {

        /** SporeFrame magic */
        magic?: (number|null);

        /** SporeFrame frameType */
        frameType?: (number|null);

        /** SporeFrame ttl */
        ttl?: (number|null);

        /** SporeFrame payload */
        payload?: (Uint8Array|null);

        /** SporeFrame crc */
        crc?: (number|null);
    }

    /** Represents a SporeFrame. */
    class SporeFrame implements ISporeFrame {

        /**
         * Constructs a new SporeFrame.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.ISporeFrame);

        /** SporeFrame magic. */
        public magic: number;

        /** SporeFrame frameType. */
        public frameType: number;

        /** SporeFrame ttl. */
        public ttl: number;

        /** SporeFrame payload. */
        public payload: Uint8Array;

        /** SporeFrame crc. */
        public crc: number;

        /**
         * Creates a new SporeFrame instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SporeFrame instance
         */
        public static create(properties?: omega_v2.ISporeFrame): omega_v2.SporeFrame;

        /**
         * Encodes the specified SporeFrame message. Does not implicitly {@link omega_v2.SporeFrame.verify|verify} messages.
         * @param message SporeFrame message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.ISporeFrame, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SporeFrame message, length delimited. Does not implicitly {@link omega_v2.SporeFrame.verify|verify} messages.
         * @param message SporeFrame message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.ISporeFrame, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SporeFrame message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SporeFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.SporeFrame;

        /**
         * Decodes a SporeFrame message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SporeFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.SporeFrame;

        /**
         * Verifies a SporeFrame message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SporeFrame message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SporeFrame
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.SporeFrame;

        /**
         * Creates a plain object from a SporeFrame message. Also converts values to other types if specified.
         * @param message SporeFrame
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.SporeFrame, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SporeFrame to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SporeFrame
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ZKProofBundle. */
    interface IZKProofBundle {

        /** ZKProofBundle kind */
        kind?: (string|null);

        /** ZKProofBundle receiptHash */
        receiptHash?: (string|null);

        /** ZKProofBundle parentGenome */
        parentGenome?: (number|null);

        /** ZKProofBundle verified */
        verified?: (boolean|null);

        /** ZKProofBundle proofBytes */
        proofBytes?: (Uint8Array|null);

        /** ZKProofBundle publicValues */
        publicValues?: (Uint8Array|null);

        /** ZKProofBundle note */
        note?: (string|null);
    }

    /** Represents a ZKProofBundle. */
    class ZKProofBundle implements IZKProofBundle {

        /**
         * Constructs a new ZKProofBundle.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.IZKProofBundle);

        /** ZKProofBundle kind. */
        public kind: string;

        /** ZKProofBundle receiptHash. */
        public receiptHash: string;

        /** ZKProofBundle parentGenome. */
        public parentGenome: number;

        /** ZKProofBundle verified. */
        public verified: boolean;

        /** ZKProofBundle proofBytes. */
        public proofBytes: Uint8Array;

        /** ZKProofBundle publicValues. */
        public publicValues: Uint8Array;

        /** ZKProofBundle note. */
        public note: string;

        /**
         * Creates a new ZKProofBundle instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ZKProofBundle instance
         */
        public static create(properties?: omega_v2.IZKProofBundle): omega_v2.ZKProofBundle;

        /**
         * Encodes the specified ZKProofBundle message. Does not implicitly {@link omega_v2.ZKProofBundle.verify|verify} messages.
         * @param message ZKProofBundle message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.IZKProofBundle, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ZKProofBundle message, length delimited. Does not implicitly {@link omega_v2.ZKProofBundle.verify|verify} messages.
         * @param message ZKProofBundle message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.IZKProofBundle, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ZKProofBundle message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ZKProofBundle
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.ZKProofBundle;

        /**
         * Decodes a ZKProofBundle message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ZKProofBundle
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.ZKProofBundle;

        /**
         * Verifies a ZKProofBundle message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ZKProofBundle message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ZKProofBundle
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.ZKProofBundle;

        /**
         * Creates a plain object from a ZKProofBundle message. Also converts values to other types if specified.
         * @param message ZKProofBundle
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.ZKProofBundle, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ZKProofBundle to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ZKProofBundle
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a TickRollupReceipt. */
    interface ITickRollupReceipt {

        /** TickRollupReceipt initialHash */
        initialHash?: (string|null);

        /** TickRollupReceipt finalHash */
        finalHash?: (string|null);

        /** TickRollupReceipt proof */
        proof?: (omega_v2.IZKProofBundle|null);
    }

    /** Represents a TickRollupReceipt. */
    class TickRollupReceipt implements ITickRollupReceipt {

        /**
         * Constructs a new TickRollupReceipt.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.ITickRollupReceipt);

        /** TickRollupReceipt initialHash. */
        public initialHash: string;

        /** TickRollupReceipt finalHash. */
        public finalHash: string;

        /** TickRollupReceipt proof. */
        public proof?: (omega_v2.IZKProofBundle|null);

        /**
         * Creates a new TickRollupReceipt instance using the specified properties.
         * @param [properties] Properties to set
         * @returns TickRollupReceipt instance
         */
        public static create(properties?: omega_v2.ITickRollupReceipt): omega_v2.TickRollupReceipt;

        /**
         * Encodes the specified TickRollupReceipt message. Does not implicitly {@link omega_v2.TickRollupReceipt.verify|verify} messages.
         * @param message TickRollupReceipt message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.ITickRollupReceipt, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified TickRollupReceipt message, length delimited. Does not implicitly {@link omega_v2.TickRollupReceipt.verify|verify} messages.
         * @param message TickRollupReceipt message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.ITickRollupReceipt, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a TickRollupReceipt message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns TickRollupReceipt
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.TickRollupReceipt;

        /**
         * Decodes a TickRollupReceipt message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns TickRollupReceipt
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.TickRollupReceipt;

        /**
         * Verifies a TickRollupReceipt message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a TickRollupReceipt message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns TickRollupReceipt
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.TickRollupReceipt;

        /**
         * Creates a plain object from a TickRollupReceipt message. Also converts values to other types if specified.
         * @param message TickRollupReceipt
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.TickRollupReceipt, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this TickRollupReceipt to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for TickRollupReceipt
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PlasmidPayload. */
    interface IPlasmidPayload {

        /** PlasmidPayload semanticType */
        semanticType?: (string|null);

        /** PlasmidPayload attractorAddress */
        attractorAddress?: (number|null);

        /** PlasmidPayload matrix */
        matrix?: (number|null);

        /** PlasmidPayload inverse */
        inverse?: (number|null);

        /** PlasmidPayload pulseFreq */
        pulseFreq?: (number|null);

        /** PlasmidPayload pulseAmp */
        pulseAmp?: (number|null);

        /** PlasmidPayload parentHash */
        parentHash?: (number|null);

        /** PlasmidPayload recursionDepth */
        recursionDepth?: (number|null);

        /** PlasmidPayload maxRecursion */
        maxRecursion?: (number|null);

        /** PlasmidPayload proposalHash */
        proposalHash?: (string|null);

        /** PlasmidPayload proposalDescription */
        proposalDescription?: (string|null);

        /** PlasmidPayload voteAye */
        voteAye?: (boolean|null);

        /** PlasmidPayload oracleName */
        oracleName?: (string|null);

        /** PlasmidPayload oracleReasoning */
        oracleReasoning?: (string|null);

        /** PlasmidPayload tau */
        tau?: (number|null);

        /** PlasmidPayload parent */
        parent?: (omega_v2.IPhaseAgentMinimal|null);

        /** PlasmidPayload claimedChild */
        claimedChild?: (omega_v2.IPhaseAgentMinimal|null);

        /** PlasmidPayload attractors */
        attractors?: (omega_v2.IAttractorMatrix[]|null);

        /** PlasmidPayload qPhase */
        qPhase?: (number|null);

        /** PlasmidPayload receiptHash */
        receiptHash?: (string|null);

        /** PlasmidPayload proofBundle */
        proofBundle?: (omega_v2.IZKProofBundle|null);

        /** PlasmidPayload rollupState */
        rollupState?: (Uint8Array|null);

        /** PlasmidPayload eventSyncBody */
        eventSyncBody?: (string|null);

        /** PlasmidPayload eventSyncTarget */
        eventSyncTarget?: (number|null);

        /** PlasmidPayload translationPolicyBody */
        translationPolicyBody?: (string|null);

        /** PlasmidPayload translationPolicyTarget */
        translationPolicyTarget?: (number|null);

        /** PlasmidPayload translationPolicyCorroborationBody */
        translationPolicyCorroborationBody?: (string|null);

        /** PlasmidPayload translationPolicyCorroborationTarget */
        translationPolicyCorroborationTarget?: (number|null);

        /** PlasmidPayload translationPolicyReplayDigestBody */
        translationPolicyReplayDigestBody?: (string|null);

        /** PlasmidPayload translationPolicyReplayDigestTarget */
        translationPolicyReplayDigestTarget?: (number|null);

        /** PlasmidPayload translationPolicyReplayDigestDigestBody */
        translationPolicyReplayDigestDigestBody?: (string|null);

        /** PlasmidPayload translationPolicyReplayDigestDigestTarget */
        translationPolicyReplayDigestDigestTarget?: (number|null);

        /** PlasmidPayload tpRddForensicReplayDigestBody */
        tpRddForensicReplayDigestBody?: (string|null);

        /** PlasmidPayload tpRddForensicReplayDigestTarget */
        tpRddForensicReplayDigestTarget?: (number|null);
    }

    /** Represents a PlasmidPayload. */
    class PlasmidPayload implements IPlasmidPayload {

        /**
         * Constructs a new PlasmidPayload.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.IPlasmidPayload);

        /** PlasmidPayload semanticType. */
        public semanticType: string;

        /** PlasmidPayload attractorAddress. */
        public attractorAddress: number;

        /** PlasmidPayload matrix. */
        public matrix: number;

        /** PlasmidPayload inverse. */
        public inverse: number;

        /** PlasmidPayload pulseFreq. */
        public pulseFreq: number;

        /** PlasmidPayload pulseAmp. */
        public pulseAmp: number;

        /** PlasmidPayload parentHash. */
        public parentHash: number;

        /** PlasmidPayload recursionDepth. */
        public recursionDepth: number;

        /** PlasmidPayload maxRecursion. */
        public maxRecursion: number;

        /** PlasmidPayload proposalHash. */
        public proposalHash: string;

        /** PlasmidPayload proposalDescription. */
        public proposalDescription: string;

        /** PlasmidPayload voteAye. */
        public voteAye: boolean;

        /** PlasmidPayload oracleName. */
        public oracleName: string;

        /** PlasmidPayload oracleReasoning. */
        public oracleReasoning: string;

        /** PlasmidPayload tau. */
        public tau: number;

        /** PlasmidPayload parent. */
        public parent?: (omega_v2.IPhaseAgentMinimal|null);

        /** PlasmidPayload claimedChild. */
        public claimedChild?: (omega_v2.IPhaseAgentMinimal|null);

        /** PlasmidPayload attractors. */
        public attractors: omega_v2.IAttractorMatrix[];

        /** PlasmidPayload qPhase. */
        public qPhase: number;

        /** PlasmidPayload receiptHash. */
        public receiptHash: string;

        /** PlasmidPayload proofBundle. */
        public proofBundle?: (omega_v2.IZKProofBundle|null);

        /** PlasmidPayload rollupState. */
        public rollupState: Uint8Array;

        /** PlasmidPayload eventSyncBody. */
        public eventSyncBody: string;

        /** PlasmidPayload eventSyncTarget. */
        public eventSyncTarget: number;

        /** PlasmidPayload translationPolicyBody. */
        public translationPolicyBody: string;

        /** PlasmidPayload translationPolicyTarget. */
        public translationPolicyTarget: number;

        /** PlasmidPayload translationPolicyCorroborationBody. */
        public translationPolicyCorroborationBody: string;

        /** PlasmidPayload translationPolicyCorroborationTarget. */
        public translationPolicyCorroborationTarget: number;

        /** PlasmidPayload translationPolicyReplayDigestBody. */
        public translationPolicyReplayDigestBody: string;

        /** PlasmidPayload translationPolicyReplayDigestTarget. */
        public translationPolicyReplayDigestTarget: number;

        /** PlasmidPayload translationPolicyReplayDigestDigestBody. */
        public translationPolicyReplayDigestDigestBody: string;

        /** PlasmidPayload translationPolicyReplayDigestDigestTarget. */
        public translationPolicyReplayDigestDigestTarget: number;

        /** PlasmidPayload tpRddForensicReplayDigestBody. */
        public tpRddForensicReplayDigestBody: string;

        /** PlasmidPayload tpRddForensicReplayDigestTarget. */
        public tpRddForensicReplayDigestTarget: number;

        /**
         * Creates a new PlasmidPayload instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PlasmidPayload instance
         */
        public static create(properties?: omega_v2.IPlasmidPayload): omega_v2.PlasmidPayload;

        /**
         * Encodes the specified PlasmidPayload message. Does not implicitly {@link omega_v2.PlasmidPayload.verify|verify} messages.
         * @param message PlasmidPayload message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.IPlasmidPayload, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified PlasmidPayload message, length delimited. Does not implicitly {@link omega_v2.PlasmidPayload.verify|verify} messages.
         * @param message PlasmidPayload message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.IPlasmidPayload, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a PlasmidPayload message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PlasmidPayload
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.PlasmidPayload;

        /**
         * Decodes a PlasmidPayload message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PlasmidPayload
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.PlasmidPayload;

        /**
         * Verifies a PlasmidPayload message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a PlasmidPayload message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PlasmidPayload
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.PlasmidPayload;

        /**
         * Creates a plain object from a PlasmidPayload message. Also converts values to other types if specified.
         * @param message PlasmidPayload
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.PlasmidPayload, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this PlasmidPayload to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PlasmidPayload
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OmegaV2Message. */
    interface IOmegaV2Message {

        /** OmegaV2Message plasmid */
        plasmid?: (omega_v2.IPlasmidPayload|null);

        /** OmegaV2Message spore */
        spore?: (omega_v2.ISporeFrame|null);
    }

    /** Represents an OmegaV2Message. */
    class OmegaV2Message implements IOmegaV2Message {

        /**
         * Constructs a new OmegaV2Message.
         * @param [properties] Properties to set
         */
        constructor(properties?: omega_v2.IOmegaV2Message);

        /** OmegaV2Message plasmid. */
        public plasmid?: (omega_v2.IPlasmidPayload|null);

        /** OmegaV2Message spore. */
        public spore?: (omega_v2.ISporeFrame|null);

        /** OmegaV2Message payload. */
        public payload?: ("plasmid"|"spore");

        /**
         * Creates a new OmegaV2Message instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OmegaV2Message instance
         */
        public static create(properties?: omega_v2.IOmegaV2Message): omega_v2.OmegaV2Message;

        /**
         * Encodes the specified OmegaV2Message message. Does not implicitly {@link omega_v2.OmegaV2Message.verify|verify} messages.
         * @param message OmegaV2Message message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: omega_v2.IOmegaV2Message, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified OmegaV2Message message, length delimited. Does not implicitly {@link omega_v2.OmegaV2Message.verify|verify} messages.
         * @param message OmegaV2Message message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: omega_v2.IOmegaV2Message, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an OmegaV2Message message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OmegaV2Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): omega_v2.OmegaV2Message;

        /**
         * Decodes an OmegaV2Message message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OmegaV2Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): omega_v2.OmegaV2Message;

        /**
         * Verifies an OmegaV2Message message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an OmegaV2Message message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OmegaV2Message
         */
        public static fromObject(object: { [k: string]: any }): omega_v2.OmegaV2Message;

        /**
         * Creates a plain object from an OmegaV2Message message. Also converts values to other types if specified.
         * @param message OmegaV2Message
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: omega_v2.OmegaV2Message, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this OmegaV2Message to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OmegaV2Message
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
