export type Params = {
	path: string;
	watch: boolean;
	verbose: boolean;
	prjDir: string;
	srcDir: string;
	outDir: string;
	tsconfigFilename: string;
	dependencies: string | null;
	allowCircular: boolean;
	incrementalBuild: boolean;
	runBefore: string[];
	runAfter: string[];
	tsconfig: {
		compilerOptions?: {
			baseUrl?: string;
			paths?: Record<string, string[]>;
		};
	};
};

export type Stats = {
	importReplacementCountJS: number;
	importReplacementCountDTS: number;
	extraModuleExtensions: Map<string, number>;
	dependencies: Map<string, string[]>;
};

export type Replacement = {
	start: number;
	end: number;
	value: string;
};
