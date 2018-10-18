/* tslint:disable no-console*/
import {inspect} from "util";

/**
 * Pretty print the provided content to the screen. Uses util.inspect to do deeper printing
 * than just a simple console.log.
 */
export function log(content: any) {
    //Clear the console window before we display the results of the operation. Makes the output a bit
    //more readable when running multiple commands in a row.
    console.log("\x1Bc");
    if (typeof content === "string") {
        console.log(content);
    } else {
        console.log(inspect(content, {depth: 5, colors: true}));
    }

    console.log("\n");
}

/**
 * Same as above just include a leading message before the printed data.
 */
export function logWithMessage(message: string, content: any) {
    console.log("\x1Bc");
    console.log(`${message}\n`);
    console.log(inspect(content, {depth: 5, colors: true}));
    console.log("\n");
}
