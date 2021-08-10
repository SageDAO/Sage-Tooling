import fs from 'fs-extra';
import path from 'path';

console.log('Creating breadcrumbtrails.json...');
let breadcrumbs = [];

fs.readdirSync("breadcrumbs").forEach(file => {
    if (file.includes(".json")) {
        try {
            var asObj = JSON.parse(fs.readFileSync('breadcrumbs/' + file, 'utf8'));
        } catch (err) {
            console.log('cannot read breadcrumb for some reason...', err);
        }
        breadcrumbs.push(asObj);
    }
});

var asJson = JSON.stringify(breadcrumbs);

fs.writeFileSync("breadcrumbtrails.json", asJson);

console.log('Created breadcrumbtrails.json...');