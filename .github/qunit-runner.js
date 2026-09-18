/**
 * Headless-Chrome runner for the jQuery QUnit suite.
 *
 * jQuery 1.11.1 shipped its unit tests as a browser page (test/index.html) that
 * upstream drove through TestSwarm, a service that no longer exists. This runner
 * loads the same page in headless Chrome and exits non-zero on any failed
 * assertion, so the suite can run on CI.
 *
 * The page must be served by a PHP-capable server: a large part of the ajax
 * module talks to test/data/*.php.
 *
 * Usage: node .github/qunit-runner.js <url>
 */

var puppeteer = require( "puppeteer-core" ),

	url = process.argv[ 2 ],
	chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome",
	timeoutMs = 15 * 60 * 1000;

function fail( message ) {
	console.error( message );
	process.exit( 1 );
}

( function() {
	var browser;

	puppeteer.launch( {
		executablePath: chrome,
		headless: "new",
		args: [ "--no-sandbox", "--disable-dev-shm-usage" ]
	} )
	.then( function( b ) {
		browser = b;
		return browser.newPage();
	} )
	.then( function( page ) {
		return page.goto( url, { waitUntil: "domcontentloaded", timeout: 120000 } )
			.then( function() {

				// Register the QUnit.done callback as soon as QUnit exists.
				return page.evaluate( function() {
					window.__qunitDone = null;
					var poll = setInterval( function() {
						if ( window.QUnit && QUnit.done ) {
							clearInterval( poll );
							QUnit.done( function( details ) {
								window.__qunitDone = details;
							} );
						}
					}, 50 );
				} );
			} )
			.then( function() {
				var waited = 0;

				function tick() {
					return page.evaluate( function() {
						return window.__qunitDone;
					} ).then( function( done ) {
						if ( done ) {
							return done;
						}
						waited += 2000;
						if ( waited >= timeoutMs ) {
							return null;
						}
						return new Promise( function( resolve ) {
							setTimeout( resolve, 2000 );
						} ).then( tick );
					} );
				}

				return tick();
			} )
			.then( function( done ) {
				if ( !done ) {
					return fail( "QUnit suite timed out after " +
						( timeoutMs / 1000 ) + "s" );
				}

				console.log( "QUnit results: " + done.passed + " passed, " +
					done.failed + " failed, " + done.total + " assertions in " +
					done.runtime + "ms" );

				return page.evaluate( function() {
					var out = [],
						items = document.querySelectorAll( "#qunit-tests > li.fail" ),
						i, module, name;

					for ( i = 0; i < items.length; i++ ) {
						module = items[ i ].querySelector( ".module-name" );
						name = items[ i ].querySelector( ".test-name" );
						out.push( ( module ? module.textContent : "?" ) + ": " +
							( name ? name.textContent : "?" ) );
					}
					return out;
				} ).then( function( failures ) {
					if ( failures.length ) {
						console.log( "Failed tests:" );
						console.log( failures.join( "\n" ) );
					}
					return browser.close().then( function() {
						if ( done.failed > 0 ) {
							return fail( "QUnit suite FAILED: " + done.failed +
								" failed assertions" );
						}
						console.log( "QUnit suite PASSED" );
					} );
				} );
			} );
	} )
	.catch( function( e ) {
		fail( "qunit-runner error: " + ( e && e.stack || e ) );
	} );
}() );
