"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidProtocolizationResultId = isValidProtocolizationResultId;
const case_identifiers_1 = require("../case/case-identifiers");
function isValidProtocolizationResultId(value) {
    return (0, case_identifiers_1.isProtocolizationInstanceIdentifier)(value);
}
