function requireArg(args, index, name) {
    const value = args[index];
    if (!value) {
        throw new Error(`Missing required argument: ${name}`);
    }
    return value;
}

function printJson(data) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function run(main) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = { requireArg, printJson, run };
