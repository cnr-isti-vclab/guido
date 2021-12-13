import { terser } from "rollup-plugin-terser";

function header() {
	return {

		renderChunk( code ) {
			return "//license \n" + code;
		}
	};

}

export default [
	{
		input: './src/tour.js',
		output: [{
			format: 'umd',
			name: 'guide2pi',
			file: 'build/guide2pi.min.js',
			plugins: [terser()],
			globals: {  }
		},
		{
			format: 'umd',
			name: 'guide2pi',
			file: 'build/guide2pi.js',
			globals: { }
		}],
		external: []
	}
	
];
