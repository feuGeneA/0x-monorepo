import * as _ from 'lodash';

import {
    AbiDefinition,
    ConstructorAbi,
    DataItem,
    DevdocOutput,
    EventAbi,
    FallbackAbi,
    MethodAbi,
    StandardContractOutput,
} from 'ethereum-types';

import { DocSection, Event, Parameter, ReactDocsType, SolidityMethod, TypeDocTypes } from '@0xproject/react-docs';
import { Compiler, CompilerOptions } from '@0xproject/sol-compiler';
import { logUtils } from '@0xproject/utils';

import { SolidityDocFormat } from './solidity_doc_format';

export class SolidityDocGenerator {
    private readonly _compilerOptions: CompilerOptions;
    private static _genSection(compiledContract: StandardContractOutput): DocSection {
        if (_.isUndefined(compiledContract.abi)) {
            throw new Error('compiled contract did not contain ABI output.');
        }

        let title;
        if (!_.isUndefined(compiledContract.devdoc)) {
            title = compiledContract.devdoc.title;
        }

        const methodDocs: SolidityMethod[] = [];
        const constructorDocs: SolidityMethod[] = [];
        const eventDocs: SolidityMethod[] = [];

        for (const abiDefinition of compiledContract.abi) {
            switch (abiDefinition.type) {
                case 'constructor':
                    methodDocs.push(SolidityDocGenerator._genConstructorDoc(abiDefinition, compiledContract.devdoc));
                    break;
                case 'event':
                    eventDocs.push(SolidityDocGenerator._genEventDoc(abiDefinition, compiledContract.devdoc));
                    break;
                default:
                    methodDocs.push(SolidityDocGenerator._genMethodDoc(abiDefinition, compiledContract.devdoc));
            }
        }

        let comment = '';
        if (!_.isUndefined(compiledContract.devdoc)) {
            comment = compiledContract.devdoc.title;
        }

        return {
            comment,
            constructors: constructorDocs,
            methods: methodDocs,
            functions: [],
            properties: [],
            types: [],
        };
    }
    private static _genConstructorDoc(
        abiDefinition: ConstructorAbi,
        devdocIfExists: DevdocOutput | undefined,
    ): SolidityMethod {
        const { parameters, methodSignature } = SolidityDocGenerator._genMethodParamsDoc(
            name,
            abiDefinition.inputs,
            devdocIfExists,
        );

        let comment;
        // TODO: use method name and parameter types to form signature, then use that signature as the key to
        // abiEntry.devdoc.methods, and from that object extract the "details" (comment) property
        comment = 'something from devdoc';

        return {
            isConstructor: true,
            name: '', // sad we have to specify this
            callPath: '', // TODO: wtf is this?
            parameters,
            returnType: SolidityDocGenerator._unspecifiedReturnType(), // sad we have to specify this
            isConstant: false, // of course it's not constant; it's a constructor!
            isPayable: abiDefinition.payable,
            comment,
        };
    }
    private static _genEventDoc(abiDefinition: EventAbi, devdocIfExists: DevdocOutput | undefined): SolidityMethod {
        const { parameters, methodSignature } = SolidityDocGenerator._genMethodParamsDoc(
            name,
            abiDefinition.inputs,
            devdocIfExists,
        );

        let comment;
        // TODO: use method name and parameter types to form signature, then use that signature as the key to
        // abiEntry.devdoc.methods, and from that object extract the "details" (comment) property
        comment = 'something from devdoc';

        return {
            isConstructor: true,
            name: abiDefinition.name,
            callPath: '', // TODO: wtf is this?
            parameters,
            returnType: SolidityDocGenerator._unspecifiedReturnType(), // sad we have to specify this
            isConstant: true, // weird, doesn't really apply here
            isPayable: false, // also weird, events can't even be payable
            comment,
        };
    }
    private static _genMethodDoc(
        abiDefinition: MethodAbi | FallbackAbi,
        devdocIfExists: DevdocOutput | undefined,
    ): SolidityMethod {
        const name = abiDefinition.type === 'fallback' ? '' : abiDefinition.name;

        const { parameters, methodSignature } =
            abiDefinition.type === 'fallback'
                ? { parameters: [], methodSignature: `${name}()` }
                : SolidityDocGenerator._genMethodParamsDoc(name, abiDefinition.inputs, devdocIfExists);

        let comment;
        // TODO: use method name and parameter types to form signature, then use that signature as the key to
        // abiEntry.devdoc.methods, and from that object extract the "details" (comment) property
        comment = 'something from devdoc';

        const returnType =
            abiDefinition.type === 'fallback'
                ? SolidityDocGenerator._unspecifiedReturnType()
                : SolidityDocGenerator._genMethodReturnTypeDoc(abiDefinition.outputs, methodSignature, devdocIfExists);

        const isConstant = abiDefinition.type === 'fallback' ? true /* TODO: is this right? */ : abiDefinition.constant;

        return {
            isConstructor: true,
            name,
            callPath: '', // TODO: wtf is this?
            parameters,
            returnType,
            isConstant,
            isPayable: abiDefinition.payable,
            comment,
        };
    }
    private static _genAbiDefDoc(
        abiDefinition: AbiDefinition,
        devdocIfExists: DevdocOutput | undefined,
    ): SolidityMethod {
        let name = '';
        if (abiDefinition.type !== 'constructor' && abiDefinition.type !== 'fallback') {
            name = abiDefinition.name;
        }

        const { parameters, methodSignature } =
            abiDefinition.type === 'fallback'
                ? { parameters: [], methodSignature: `${name}()` }
                : SolidityDocGenerator._genMethodParamsDoc(name, abiDefinition.inputs, devdocIfExists);

        let comment;
        // TODO: use method name and parameter types to form signature, then use that signature as the key to
        // abiEntry.devdoc.methods, and from that object extract the "details" (comment) property
        comment = 'something from devdoc';

        let returnType = SolidityDocGenerator._unspecifiedReturnType();
        if (
            abiDefinition.type !== 'constructor' &&
            abiDefinition.type !== 'fallback' &&
            abiDefinition.type !== 'event'
        ) {
            returnType = SolidityDocGenerator._genMethodReturnTypeDoc(
                abiDefinition.outputs,
                methodSignature,
                devdocIfExists,
            );
        }

        let isConstant;
        if (
            abiDefinition.type !== 'fallback' &&
            abiDefinition.type !== 'event' &&
            abiDefinition.type !== 'constructor'
        ) {
            isConstant = abiDefinition.constant;
        }

        let isPayable;
        if (abiDefinition.type !== 'event') {
            isPayable = abiDefinition.payable;
        }

        const methodDoc: SolidityMethod = {
            isConstructor: abiDefinition.type === 'constructor',
            name,
            callPath: '', // TODO: wtf is this?
            parameters,
            returnType,
            isConstant,
            isPayable,
            // returnComment: TODO
            comment,
        };

        return methodDoc;
    }
    private static _genMethodParamsDoc(
        name: string,
        params: DataItem[],
        devdocIfExists: DevdocOutput | undefined,
    ): { parameters: Parameter[]; methodSignature: string } {
        const parameters: Parameter[] = [];
        for (const input of params) {
            const parameter: Parameter = {
                name: input.name,
                comment: '', // TODO: get from devdoc. see comment below.
                isOptional: false, // Unsupported in Solidity, until resolution of https://github.com/ethereum/solidity/issues/232
                type: { name: input.type, typeDocType: TypeDocTypes.Unknown }, // TODO: handle typeDocType properly
            };
            parameters.push(parameter);
        }
        // TODO: use method name and parameter types to form signature, then use that signature as the key to
        // abiEntry.devdoc.methods, and from that object extract the "params" (names and desc's) properties.
        return { parameters, methodSignature: '' };
    }
    private static _genMethodReturnTypeDoc(
        outputs: DataItem[],
        methodSignature: string,
        devdocIfExists: DevdocOutput | undefined,
    ): ReactDocsType {
        // TODO: see if there's a way to use outputs[i].type to interpret a better value for returnType.typeDocType.
        const returnType = SolidityDocGenerator._unspecifiedReturnType();
        if (outputs.length > 1) {
            returnType.typeDocType = TypeDocTypes.Tuple;
            returnType.tupleElements = [];
            for (const output of outputs) {
                returnType.tupleElements.push({ name: output.name, typeDocType: TypeDocTypes.Unknown });
            }
        } else {
            returnType.typeDocType = TypeDocTypes.Unknown;
            returnType.name = outputs[0].name;
        }
        return returnType;
    }
    private static _unspecifiedReturnType(): ReactDocsType {
        // TODO: see if there's a better way to do this
        return Object.create({ name: 'UNKNOWN', typeDocType: TypeDocTypes.Unknown });
    }
    constructor(contractsDir: string, artifactsDir: string) {
        // instantiate sol-compiler, passing in options to say we want abi and devdoc
        this._compilerOptions = {
            contractsDir,
            artifactsDir,
            contracts: '*',
            compilerSettings: {
                outputSelection: {
                    ['*']: {
                        ['*']: ['abi', 'devdoc'],
                    },
                },
            },
        };
    }
    /// run `contractsToCompile` through compiler, gathering output
    public async generateAsync(contractsToCompile: string[]): Promise<SolidityDocFormat> {
        if (!_.isUndefined(contractsToCompile)) {
            this._compilerOptions.contracts = contractsToCompile;
        }

        const compiler = new Compiler(this._compilerOptions);

        const doc = new SolidityDocFormat();

        const compilerOutputs = await compiler.getCompilerOutputsAsync();
        for (const compilerOutput of compilerOutputs) {
            const solidityModules = _.keys(compilerOutput.contracts);
            for (const solidityModule of solidityModules) {
                const compiledSolidityModule = compilerOutput.contracts[solidityModule];

                const contracts = _.keys(compiledSolidityModule);
                for (const contract of contracts) {
                    const compiledContract = compiledSolidityModule[contract];

                    doc[contract] = SolidityDocGenerator._genSection(compiledContract);
                }
            }
        }

        logUtils.log(`generated doc:\n${JSON.stringify(doc)}`);

        return doc;
    }
}
