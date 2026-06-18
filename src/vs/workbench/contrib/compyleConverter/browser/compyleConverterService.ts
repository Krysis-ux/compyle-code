/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITerminalService, ITerminalGroupService } from '../../terminal/browser/terminal.js';
import { buildConvertCommand, ICompyleFormat } from '../common/compyleConverterFormats.js';

export const COMPYLE_CONVERTER_ENABLED_SETTING = 'compyle.converter.enabled';
export const COMPYLE_CONVERTER_CONVERTX_ENDPOINT_SETTING = 'compyle.converter.convertxEndpoint';
export const COMPYLE_CONVERTER_OUTPUT_DIR_SETTING = 'compyle.converter.outputDirectory';

export const ICompyleConverterService = createDecorator<ICompyleConverterService>('compyleConverterService');

export interface ICompyleConversionResult {
	readonly command: string;
	readonly outputPath: string;
}

export interface ICompyleConverterService {
	readonly _serviceBrand: undefined;
	/** Run a conversion of `input` to the chosen target format in a terminal. */
	convert(input: URI, format: ICompyleFormat): Promise<ICompyleConversionResult>;
	hasConvertXEndpoint(): boolean;
	/** Open the configured ConvertX web UI for the long tail of formats. */
	openConvertX(): Promise<void>;
}

function dirOf(path: string): string {
	const norm = path.replace(/\\/g, '/');
	const idx = norm.lastIndexOf('/');
	return idx >= 0 ? path.slice(0, idx) : '.';
}

function baseNoExt(path: string): string {
	const norm = path.replace(/\\/g, '/');
	const name = norm.slice(norm.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(0, dot) : name;
}

export class CompyleConverterService extends Disposable implements ICompyleConverterService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@ICommandService private readonly _commandService: ICommandService,
		@IOpenerService private readonly _openerService: IOpenerService,
	) {
		super();
	}

	async convert(input: URI, format: ICompyleFormat): Promise<ICompyleConversionResult> {
		const inputPath = input.fsPath;
		const configuredDir = this._configurationService.getValue<string>(COMPYLE_CONVERTER_OUTPUT_DIR_SETTING);
		const outputDir = configuredDir && configuredDir.trim() ? configuredDir.trim() : dirOf(inputPath);
		const sep = outputDir.includes('\\') ? '\\' : '/';
		const outputPath = `${outputDir}${sep}${baseNoExt(inputPath)}.${format.ext}`;

		const command = buildConvertCommand(format, inputPath, outputPath, outputDir);

		const instance = await this._terminalService.createTerminal({ cwd: URI.file(outputDir) });
		this._terminalService.setActiveInstance(instance);
		await this._terminalGroupService.showPanel(true);
		await instance.sendText(command, true);

		return { command, outputPath };
	}

	hasConvertXEndpoint(): boolean {
		return !!this._endpoint();
	}

	async openConvertX(): Promise<void> {
		const endpoint = this._endpoint();
		if (!endpoint) {
			return;
		}
		try {
			await this._commandService.executeCommand('simpleBrowser.show', endpoint);
		} catch {
			await this._openerService.open(URI.parse(endpoint));
		}
	}

	private _endpoint(): string {
		return (this._configurationService.getValue<string>(COMPYLE_CONVERTER_CONVERTX_ENDPOINT_SETTING) || '').trim();
	}
}

registerSingleton(ICompyleConverterService, CompyleConverterService, InstantiationType.Delayed);
