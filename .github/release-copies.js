/**
 * Standalone version of the makeReleaseCopies() step from build/release.js.
 *
 * Populates dist/cdn/ with the nine files that ship inside the published
 * npm tarball. Plain CommonJS, no dependencies beyond fs/path so it runs
 * under node 0.10 without any extra devDependencies.
 */

var fs = require( "fs" ),
	path = require( "path" ),

	rootDir = path.join( __dirname, ".." ),

	version = JSON.parse(
		fs.readFileSync( path.join( rootDir, "package.json" ), "utf8" )
	).version,

	devFile = path.join( rootDir, "dist", "jquery.js" ),
	minFile = path.join( rootDir, "dist", "jquery.min.js" ),
	mapFile = path.join( rootDir, "dist", "jquery.min.map" ),

	cdnFolder = path.join( rootDir, "dist", "cdn" ),

	releaseFiles = {
		"jquery-VER.js": devFile,
		"jquery-VER.min.js": minFile,
		"jquery-VER.min.map": mapFile,
		"jquery.js": devFile,
		"jquery.min.js": minFile,
		"jquery.min.map": mapFile,
		"jquery-latest.js": devFile,
		"jquery-latest.min.js": minFile,
		"jquery-latest.min.map": mapFile
	};

function makeReleaseCopies() {
	if ( !fs.existsSync( cdnFolder ) ) {
		fs.mkdirSync( cdnFolder );
	}

	Object.keys( releaseFiles ).forEach( function( key ) {
		var text,
			builtFile = releaseFiles[ key ],
			unpathedFile = key.replace( /VER/g, version ),
			releaseFile = path.join( cdnFolder, unpathedFile );

		text = fs.readFileSync( builtFile, "utf8" );

		if ( /\.min\.map$/.test( unpathedFile ) ) {

			// Map files need to reference the new uncompressed name;
			// assume that all files reside in the same directory.
			// "file":"jquery.min.js","sources":["jquery.js"]
			text = text.replace( /"file":"([^"]+)","sources":\["([^"]+)"\]/,
				"\"file\":\"" + unpathedFile.replace( /\.min\.map/, ".min.js" ) +
				"\",\"sources\":[\"" + unpathedFile.replace( /\.min\.map/, ".js" ) + "\"]" );
		} else if ( /\.min\.js$/.test( unpathedFile ) ) {

			// Remove the source map comment; it causes way too many problems.
			// Keep the map file in case DevTools allow manual association.
			text = text.replace( /\/\/# sourceMappingURL=\S+/, "" );
		}

		fs.writeFileSync( releaseFile, text, "utf8" );
		console.log( "Created " + releaseFile );
	} );
}

makeReleaseCopies();
