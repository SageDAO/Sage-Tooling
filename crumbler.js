import fs from 'fs-extra';
import path from 'path';

let breadcrumbs = []

fs.readdirSync("breadcrumbs").forEach(file => {
    var asObj = JSON.parse(fs.readFileSync('breadcrumbs/' + file, 'utf8'));
    breadcrumbs.push(asObj);
});

var asJson = JSON.stringify(breadcrumbs);

fs.writeFileSync("breadcrumbtrails.json", asJson);