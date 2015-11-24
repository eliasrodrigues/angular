import { assertionsEnabled, isBlank } from 'angular2/src/facade/lang';
import { BaseException } from 'angular2/src/facade/exceptions';
import { ListWrapper } from 'angular2/src/facade/collection';
import { AbstractChangeDetector } from './abstract_change_detector';
import { ChangeDetectionUtil } from './change_detection_util';
import { RecordType } from './proto_record';
import { CodegenNameUtil, sanitizeName } from './codegen_name_util';
import { CodegenLogicUtil } from './codegen_logic_util';
import { codify } from './codegen_facade';
import { ChangeDetectorState } from './constants';
import { createPropertyRecords, createEventRecords } from './proto_change_detector';
/**
 * The code generator takes a list of proto records and creates a function/class
 * that "emulates" what the developer would write by hand to implement the same
 * kind of behaviour.
 *
 * This code should be kept in sync with the Dart transformer's
 * `angular2.transform.template_compiler.change_detector_codegen` library. If you make updates
 * here, please make equivalent changes there.
*/
const IS_CHANGED_LOCAL = "isChanged";
const CHANGES_LOCAL = "changes";
export class ChangeDetectorJITGenerator {
    constructor(definition, changeDetectionUtilVarName, abstractChangeDetectorVarName, changeDetectorStateVarName) {
        this.changeDetectionUtilVarName = changeDetectionUtilVarName;
        this.abstractChangeDetectorVarName = abstractChangeDetectorVarName;
        this.changeDetectorStateVarName = changeDetectorStateVarName;
        var propertyBindingRecords = createPropertyRecords(definition);
        var eventBindingRecords = createEventRecords(definition);
        var propertyBindingTargets = definition.bindingRecords.map(b => b.target);
        this.id = definition.id;
        this.changeDetectionStrategy = definition.strategy;
        this.genConfig = definition.genConfig;
        this.records = propertyBindingRecords;
        this.propertyBindingTargets = propertyBindingTargets;
        this.eventBindings = eventBindingRecords;
        this.directiveRecords = definition.directiveRecords;
        this._names = new CodegenNameUtil(this.records, this.eventBindings, this.directiveRecords, this.changeDetectionUtilVarName);
        this._logic =
            new CodegenLogicUtil(this._names, this.changeDetectionUtilVarName, this.changeDetectorStateVarName, this.changeDetectionStrategy);
        this.typeName = sanitizeName(`ChangeDetector_${this.id}`);
    }
    generate() {
        var factorySource = `
      ${this.generateSource()}
      return function(dispatcher) {
        return new ${this.typeName}(dispatcher);
      }
    `;
        return new Function(this.abstractChangeDetectorVarName, this.changeDetectionUtilVarName, this.changeDetectorStateVarName, factorySource)(AbstractChangeDetector, ChangeDetectionUtil, ChangeDetectorState);
    }
    generateSource() {
        return `
      var ${this.typeName} = function ${this.typeName}(dispatcher) {
        ${this.abstractChangeDetectorVarName}.call(
            this, ${JSON.stringify(this.id)}, dispatcher, ${this.records.length},
            ${this.typeName}.gen_propertyBindingTargets, ${this.typeName}.gen_directiveIndices,
            ${codify(this.changeDetectionStrategy)});
        this.dehydrateDirectives(false);
      }

      ${this.typeName}.prototype = Object.create(${this.abstractChangeDetectorVarName}.prototype);

      ${this.typeName}.prototype.detectChangesInRecordsInternal = function(throwOnChange) {
        ${this._names.genInitLocals()}
        var ${IS_CHANGED_LOCAL} = false;
        var ${CHANGES_LOCAL} = null;

        ${this._genAllRecords(this.records)}
      }

      ${this._maybeGenHandleEventInternal()}

      ${this._maybeGenAfterContentLifecycleCallbacks()}

      ${this._maybeGenAfterViewLifecycleCallbacks()}

      ${this._maybeGenHydrateDirectives()}

      ${this._maybeGenDehydrateDirectives()}

      ${this._genPropertyBindingTargets()}

      ${this._genDirectiveIndices()}
    `;
    }
    /** @internal */
    _genPropertyBindingTargets() {
        var targets = this._logic.genPropertyBindingTargets(this.propertyBindingTargets, this.genConfig.genDebugInfo);
        return `${this.typeName}.gen_propertyBindingTargets = ${targets};`;
    }
    /** @internal */
    _genDirectiveIndices() {
        var indices = this._logic.genDirectiveIndices(this.directiveRecords);
        return `${this.typeName}.gen_directiveIndices = ${indices};`;
    }
    /** @internal */
    _maybeGenHandleEventInternal() {
        if (this.eventBindings.length > 0) {
            var handlers = this.eventBindings.map(eb => this._genEventBinding(eb)).join("\n");
            return `
        ${this.typeName}.prototype.handleEventInternal = function(eventName, elIndex, locals) {
          var ${this._names.getPreventDefaultAccesor()} = false;
          ${this._names.genInitEventLocals()}
          ${handlers}
          return ${this._names.getPreventDefaultAccesor()};
        }
      `;
        }
        else {
            return '';
        }
    }
    /** @internal */
    _genEventBinding(eb) {
        let codes = [];
        this._endOfBlockIdxs = [];
        ListWrapper.forEachWithIndex(eb.records, (r, i) => {
            let code;
            if (r.isConditionalSkipRecord()) {
                code = this._genConditionalSkip(r, this._names.getEventLocalName(eb, i));
            }
            else if (r.isUnconditionalSkipRecord()) {
                code = this._genUnconditionalSkip(r);
            }
            else {
                code = this._genEventBindingEval(eb, r);
            }
            code += this._genEndOfSkipBlock(i);
            codes.push(code);
        });
        return `
    if (eventName === "${eb.eventName}" && elIndex === ${eb.elIndex}) {
      ${codes.join("\n")}
    }`;
    }
    /** @internal */
    _genEventBindingEval(eb, r) {
        if (r.lastInBinding) {
            var evalRecord = this._logic.genEventBindingEvalValue(eb, r);
            var markPath = this._genMarkPathToRootAsCheckOnce(r);
            var prevDefault = this._genUpdatePreventDefault(eb, r);
            return `${evalRecord}\n${markPath}\n${prevDefault}`;
        }
        else {
            return this._logic.genEventBindingEvalValue(eb, r);
        }
    }
    /** @internal */
    _genMarkPathToRootAsCheckOnce(r) {
        var br = r.bindingRecord;
        if (br.isDefaultChangeDetection()) {
            return "";
        }
        else {
            return `${this._names.getDetectorName(br.directiveRecord.directiveIndex)}.markPathToRootAsCheckOnce();`;
        }
    }
    /** @internal */
    _genUpdatePreventDefault(eb, r) {
        var local = this._names.getEventLocalName(eb, r.selfIndex);
        return `if (${local} === false) { ${this._names.getPreventDefaultAccesor()} = true};`;
    }
    /** @internal */
    _maybeGenDehydrateDirectives() {
        var destroyPipesCode = this._names.genPipeOnDestroy();
        if (destroyPipesCode) {
            destroyPipesCode = `if (destroyPipes) { ${destroyPipesCode} }`;
        }
        var dehydrateFieldsCode = this._names.genDehydrateFields();
        if (!destroyPipesCode && !dehydrateFieldsCode)
            return '';
        return `${this.typeName}.prototype.dehydrateDirectives = function(destroyPipes) {
        ${destroyPipesCode}
        ${dehydrateFieldsCode}
    }`;
    }
    /** @internal */
    _maybeGenHydrateDirectives() {
        var hydrateDirectivesCode = this._logic.genHydrateDirectives(this.directiveRecords);
        var hydrateDetectorsCode = this._logic.genHydrateDetectors(this.directiveRecords);
        if (!hydrateDirectivesCode && !hydrateDetectorsCode)
            return '';
        return `${this.typeName}.prototype.hydrateDirectives = function(directives) {
      ${hydrateDirectivesCode}
      ${hydrateDetectorsCode}
    }`;
    }
    /** @internal */
    _maybeGenAfterContentLifecycleCallbacks() {
        var notifications = this._logic.genContentLifecycleCallbacks(this.directiveRecords);
        if (notifications.length > 0) {
            var directiveNotifications = notifications.join("\n");
            return `
        ${this.typeName}.prototype.afterContentLifecycleCallbacksInternal = function() {
          ${directiveNotifications}
        }
      `;
        }
        else {
            return '';
        }
    }
    /** @internal */
    _maybeGenAfterViewLifecycleCallbacks() {
        var notifications = this._logic.genViewLifecycleCallbacks(this.directiveRecords);
        if (notifications.length > 0) {
            var directiveNotifications = notifications.join("\n");
            return `
        ${this.typeName}.prototype.afterViewLifecycleCallbacksInternal = function() {
          ${directiveNotifications}
        }
      `;
        }
        else {
            return '';
        }
    }
    /** @internal */
    _genAllRecords(rs) {
        var codes = [];
        this._endOfBlockIdxs = [];
        for (let i = 0; i < rs.length; i++) {
            let code;
            let r = rs[i];
            if (r.isLifeCycleRecord()) {
                code = this._genDirectiveLifecycle(r);
            }
            else if (r.isPipeRecord()) {
                code = this._genPipeCheck(r);
            }
            else if (r.isConditionalSkipRecord()) {
                code = this._genConditionalSkip(r, this._names.getLocalName(r.contextIndex));
            }
            else if (r.isUnconditionalSkipRecord()) {
                code = this._genUnconditionalSkip(r);
            }
            else {
                code = this._genReferenceCheck(r);
            }
            code = `
        ${this._maybeFirstInBinding(r)}
        ${code}
        ${this._maybeGenLastInDirective(r)}
        ${this._genEndOfSkipBlock(i)}
      `;
            codes.push(code);
        }
        return codes.join("\n");
    }
    /** @internal */
    _genConditionalSkip(r, condition) {
        let maybeNegate = r.mode === RecordType.SkipRecordsIf ? '!' : '';
        this._endOfBlockIdxs.push(r.fixedArgs[0] - 1);
        return `if (${maybeNegate}${condition}) {`;
    }
    /** @internal */
    _genUnconditionalSkip(r) {
        this._endOfBlockIdxs.pop();
        this._endOfBlockIdxs.push(r.fixedArgs[0] - 1);
        return `} else {`;
    }
    /** @internal */
    _genEndOfSkipBlock(protoIndex) {
        if (!ListWrapper.isEmpty(this._endOfBlockIdxs)) {
            let endOfBlock = ListWrapper.last(this._endOfBlockIdxs);
            if (protoIndex === endOfBlock) {
                this._endOfBlockIdxs.pop();
                return '}';
            }
        }
        return '';
    }
    /** @internal */
    _genDirectiveLifecycle(r) {
        if (r.name === "DoCheck") {
            return this._genOnCheck(r);
        }
        else if (r.name === "OnInit") {
            return this._genOnInit(r);
        }
        else if (r.name === "OnChanges") {
            return this._genOnChange(r);
        }
        else {
            throw new BaseException(`Unknown lifecycle event '${r.name}'`);
        }
    }
    /** @internal */
    _genPipeCheck(r) {
        var context = this._names.getLocalName(r.contextIndex);
        var argString = r.args.map((arg) => this._names.getLocalName(arg)).join(", ");
        var oldValue = this._names.getFieldName(r.selfIndex);
        var newValue = this._names.getLocalName(r.selfIndex);
        var pipe = this._names.getPipeName(r.selfIndex);
        var pipeName = r.name;
        var init = `
      if (${pipe} === ${this.changeDetectionUtilVarName}.uninitialized) {
        ${pipe} = ${this._names.getPipesAccessorName()}.get('${pipeName}');
      }
    `;
        var read = `${newValue} = ${pipe}.pipe.transform(${context}, [${argString}]);`;
        var contexOrArgCheck = r.args.map((a) => this._names.getChangeName(a));
        contexOrArgCheck.push(this._names.getChangeName(r.contextIndex));
        var condition = `!${pipe}.pure || (${contexOrArgCheck.join(" || ")})`;
        var check = `
      if (${this.changeDetectionUtilVarName}.looseNotIdentical(${oldValue}, ${newValue})) {
        ${newValue} = ${this.changeDetectionUtilVarName}.unwrapValue(${newValue})
        ${this._genChangeMarker(r)}
        ${this._genUpdateDirectiveOrElement(r)}
        ${this._genAddToChanges(r)}
        ${oldValue} = ${newValue};
      }
    `;
        var genCode = r.shouldBeChecked() ? `${read}${check}` : read;
        if (r.isUsedByOtherRecord()) {
            return `${init} if (${condition}) { ${genCode} } else { ${newValue} = ${oldValue}; }`;
        }
        else {
            return `${init} if (${condition}) { ${genCode} }`;
        }
    }
    /** @internal */
    _genReferenceCheck(r) {
        var oldValue = this._names.getFieldName(r.selfIndex);
        var newValue = this._names.getLocalName(r.selfIndex);
        var read = `
      ${this._logic.genPropertyBindingEvalValue(r)}
    `;
        var check = `
      if (${this.changeDetectionUtilVarName}.looseNotIdentical(${oldValue}, ${newValue})) {
        ${this._genChangeMarker(r)}
        ${this._genUpdateDirectiveOrElement(r)}
        ${this._genAddToChanges(r)}
        ${oldValue} = ${newValue};
      }
    `;
        var genCode = r.shouldBeChecked() ? `${read}${check}` : read;
        if (r.isPureFunction()) {
            var condition = r.args.map((a) => this._names.getChangeName(a)).join(" || ");
            if (r.isUsedByOtherRecord()) {
                return `if (${condition}) { ${genCode} } else { ${newValue} = ${oldValue}; }`;
            }
            else {
                return `if (${condition}) { ${genCode} }`;
            }
        }
        else {
            return genCode;
        }
    }
    /** @internal */
    _genChangeMarker(r) {
        return r.argumentToPureFunction ? `${this._names.getChangeName(r.selfIndex)} = true` : ``;
    }
    /** @internal */
    _genUpdateDirectiveOrElement(r) {
        if (!r.lastInBinding)
            return "";
        var newValue = this._names.getLocalName(r.selfIndex);
        var oldValue = this._names.getFieldName(r.selfIndex);
        var notifyDebug = this.genConfig.logBindingUpdate ? `this.logBindingUpdate(${newValue});` : "";
        var br = r.bindingRecord;
        if (br.target.isDirective()) {
            var directiveProperty = `${this._names.getDirectiveName(br.directiveRecord.directiveIndex)}.${br.target.name}`;
            return `
        ${this._genThrowOnChangeCheck(oldValue, newValue)}
        ${directiveProperty} = ${newValue};
        ${notifyDebug}
        ${IS_CHANGED_LOCAL} = true;
      `;
        }
        else {
            return `
        ${this._genThrowOnChangeCheck(oldValue, newValue)}
        this.notifyDispatcher(${newValue});
        ${notifyDebug}
      `;
        }
    }
    /** @internal */
    _genThrowOnChangeCheck(oldValue, newValue) {
        if (assertionsEnabled()) {
            return `
        if(throwOnChange) {
          this.throwOnChangeError(${oldValue}, ${newValue});
        }
        `;
        }
        else {
            return '';
        }
    }
    /** @internal */
    _genAddToChanges(r) {
        var newValue = this._names.getLocalName(r.selfIndex);
        var oldValue = this._names.getFieldName(r.selfIndex);
        if (!r.bindingRecord.callOnChanges())
            return "";
        return `${CHANGES_LOCAL} = this.addChange(${CHANGES_LOCAL}, ${oldValue}, ${newValue});`;
    }
    /** @internal */
    _maybeFirstInBinding(r) {
        var prev = ChangeDetectionUtil.protoByIndex(this.records, r.selfIndex - 1);
        var firstInBinding = isBlank(prev) || prev.bindingRecord !== r.bindingRecord;
        return firstInBinding && !r.bindingRecord.isDirectiveLifecycle() ?
            `${this._names.getPropertyBindingIndex()} = ${r.propertyBindingIndex};` :
            '';
    }
    /** @internal */
    _maybeGenLastInDirective(r) {
        if (!r.lastInDirective)
            return "";
        return `
      ${CHANGES_LOCAL} = null;
      ${this._genNotifyOnPushDetectors(r)}
      ${IS_CHANGED_LOCAL} = false;
    `;
    }
    /** @internal */
    _genOnCheck(r) {
        var br = r.bindingRecord;
        return `if (!throwOnChange) ${this._names.getDirectiveName(br.directiveRecord.directiveIndex)}.doCheck();`;
    }
    /** @internal */
    _genOnInit(r) {
        var br = r.bindingRecord;
        return `if (!throwOnChange && ${this._names.getStateName()} === ${this.changeDetectorStateVarName}.NeverChecked) ${this._names.getDirectiveName(br.directiveRecord.directiveIndex)}.onInit();`;
    }
    /** @internal */
    _genOnChange(r) {
        var br = r.bindingRecord;
        return `if (!throwOnChange && ${CHANGES_LOCAL}) ${this._names.getDirectiveName(br.directiveRecord.directiveIndex)}.onChanges(${CHANGES_LOCAL});`;
    }
    /** @internal */
    _genNotifyOnPushDetectors(r) {
        var br = r.bindingRecord;
        if (!r.lastInDirective || br.isDefaultChangeDetection())
            return "";
        var retVal = `
      if(${IS_CHANGED_LOCAL}) {
        ${this._names.getDetectorName(br.directiveRecord.directiveIndex)}.markAsCheckOnce();
      }
    `;
        return retVal;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbmdlX2RldGVjdGlvbl9qaXRfZ2VuZXJhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYW5ndWxhcjIvc3JjL2NvcmUvY2hhbmdlX2RldGVjdGlvbi9jaGFuZ2VfZGV0ZWN0aW9uX2ppdF9nZW5lcmF0b3IudHMiXSwibmFtZXMiOlsiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IiLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5jb25zdHJ1Y3RvciIsIkNoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yLmdlbmVyYXRlIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuZ2VuZXJhdGVTb3VyY2UiLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuUHJvcGVydHlCaW5kaW5nVGFyZ2V0cyIsIkNoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yLl9nZW5EaXJlY3RpdmVJbmRpY2VzIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX21heWJlR2VuSGFuZGxlRXZlbnRJbnRlcm5hbCIsIkNoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yLl9nZW5FdmVudEJpbmRpbmciLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuRXZlbnRCaW5kaW5nRXZhbCIsIkNoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yLl9nZW5NYXJrUGF0aFRvUm9vdEFzQ2hlY2tPbmNlIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX2dlblVwZGF0ZVByZXZlbnREZWZhdWx0IiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX21heWJlR2VuRGVoeWRyYXRlRGlyZWN0aXZlcyIsIkNoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yLl9tYXliZUdlbkh5ZHJhdGVEaXJlY3RpdmVzIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX21heWJlR2VuQWZ0ZXJDb250ZW50TGlmZWN5Y2xlQ2FsbGJhY2tzIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX21heWJlR2VuQWZ0ZXJWaWV3TGlmZWN5Y2xlQ2FsbGJhY2tzIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX2dlbkFsbFJlY29yZHMiLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuQ29uZGl0aW9uYWxTa2lwIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX2dlblVuY29uZGl0aW9uYWxTa2lwIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX2dlbkVuZE9mU2tpcEJsb2NrIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX2dlbkRpcmVjdGl2ZUxpZmVjeWNsZSIsIkNoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yLl9nZW5QaXBlQ2hlY2siLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuUmVmZXJlbmNlQ2hlY2siLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuQ2hhbmdlTWFya2VyIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX2dlblVwZGF0ZURpcmVjdGl2ZU9yRWxlbWVudCIsIkNoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yLl9nZW5UaHJvd09uQ2hhbmdlQ2hlY2siLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuQWRkVG9DaGFuZ2VzIiwiQ2hhbmdlRGV0ZWN0b3JKSVRHZW5lcmF0b3IuX21heWJlRmlyc3RJbkJpbmRpbmciLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fbWF5YmVHZW5MYXN0SW5EaXJlY3RpdmUiLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuT25DaGVjayIsIkNoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yLl9nZW5PbkluaXQiLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuT25DaGFuZ2UiLCJDaGFuZ2VEZXRlY3RvckpJVEdlbmVyYXRvci5fZ2VuTm90aWZ5T25QdXNoRGV0ZWN0b3JzIl0sIm1hcHBpbmdzIjoiT0FBTyxFQUFPLGlCQUFpQixFQUFFLE9BQU8sRUFB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O1FBQ3ZEQSxJQUFJQSxTQUFTQSxHQUFHQSxDQUFDQSxDQUFDQSxJQUFJQSxDQUFDQSxHQUFHQSxDQUFDQSxDQUFDQSxHQUFHQSxLQUFLQSxJQUFJQSxDQUFDQSxNQUFNQSxDQUFDQSxZQUFZQSxDQUFDQSxHQUFHQSxDQUFDQSxDQUFDQSxDQUFDQSxJQUFJQSxDQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTtRQUU5RUEsSUFBSUEsUUFBUUEsR0FBR0EsSUFBSUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsWUFBWUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsU0FBU0EsQ0FBQ0EsQ0FBQ0E7UUFDckRBLElBQUlBLFFBQVFBLEdBQUdBLElBQUlBLENBQUNBLE1BQU1BLENBQUNBLFlBQVlBLENBQUNBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBO1FBRXJEQSxJQUFJQSxJQUFJQSxHQUFHQSxJQUFJQSxDQUFDQSxNQUFNQSxDQUFDQSxXQUFXQSxDQUFDQSxDQUFDQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQTtRQUNoREEsSUFBSUEsUUFBUUEsR0FBR0EsQ0FBQ0EsQ0FBQ0EsSUFBSUEsQ0FBQ0E7UUFFdEJBLElBQUlBLElBQUlBLEdBQUdBO1lBQ0hBLElBQUlBLFFBQVFBLElBQUlBLENBQUNBLDBCQUEwQkE7VUFDN0NBLElBQUlBLE1BQU1BLElBQUlBLENBQUNBLE1BQU1BLENBQUNBLG9CQUFvQkEsRUFBRUEsU0FBU0EsUUFBUUE7O0tBRWxFQSxDQUFDQTtRQUNGQSxJQUFJQSxJQUFJQSxHQUFHQSxHQUFHQSxRQUFRQSxNQUFNQSxJQUFJQSxtQkFBbUJBLE9BQU9BLE1BQU1BLFNBQVNBLEtBQUtBLENBQUNBO1FBRS9FQSxJQUFJQSxnQkFBZ0JBLEdBQUdBLENBQUNBLENBQUNBLElBQUlBLENBQUNBLEdBQUdBLENBQUNBLENBQUNBLENBQUNBLEtBQUtBLElBQUlBLENBQUNBLE1BQU1BLENBQUNBLGFBQWFBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO1FBQ3ZFQSxnQkFBZ0JBLENBQUNBLElBQUlBLENBQUNBLElB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Y0EsYUFBYUEsSUFBSUEsQ0FBQ0E7SUFDbkpBLENBQUNBO0lBRUQ5QixnQkFBZ0JBO0lBQ2hCQSx5QkFBeUJBLENBQUNBLENBQWNBO1FBQ3RDK0IsSUFBSUEsRUFBRUEsR0FBR0EsQ0FBQ0EsQ0FBQ0EsYUFBYUEsQ0FBQ0E7UUFDekJBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLGVBQWVBLElBQUlBLEVBQUVBLENBQUNBLHdCQUF3QkEsRUFBRUEsQ0FBQ0E7WUFBQ0EsTUFBTUEsQ0FBQ0EsRUFBRUEsQ0FBQ0E7UUFDbkVBLElBQUlBLE1BQU1BLEdBQUdBO1dBQ05BLGdCQUFnQkE7VUFDakJBLElBQUlBLENBQUNBLE1BQU1BLENBQUNBLGVBQWVBLENBQUNBLEVBQUVBLENBQUNBLGVBQWVBLENBQUNBLGNBQWNBLENBQUNBOztLQUVuRUEsQ0FBQ0E7UUFDRkEsTUFBTUEsQ0FBQ0EsTUFBTUEsQ0FBQ0E7SUFDaEJBLENBQUNBO0FBQ0gvQixDQUFDQTtBQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtUeXBlLCBhc3NlcnRpb25zRW5hYmxlZCwgaXNCbGFuaywgaXNQcmVzZW50LCBTdHJpbmdXcmFwcGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2xhbmcnO1xuaW1wb3J0IHtCYXNlRXhjZXB0aW9ufSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2V4Y2VwdGlvbnMnO1xuaW1wb3J0IHtMaXN0V3JhcHBlciwgTWFwV3JhcHBlciwgU3RyaW5nTWFwV3JhcHBlcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9jb2xsZWN0aW9uJztcblxuaW1wb3J0IHtBYnN0cmFjdENoYW5nZURldGVjdG9yfSBmcm9tICcuL2Fic3RyYWN0X2NoYW5nZV9kZXRlY3Rvcic7XG5pbXBvcnQge0NoYW5nZURldGVjdGlvblV0aWx9IGZyb20gJy4vY2hhbmdlX2RldGVjdGlvbl91dGlsJztcbmltcG9ydCB7RGlyZWN0aXZlSW5kZXgsIERpcmVjdGl2ZVJlY29yZH0gZnJvbSAnLi9kaXJlY3RpdmVfcmVjb3JkJztcblxuaW1wb3J0IHtQcm90b1JlY29yZCwgUmVjb3JkVHlwZX0gZnJvbSAnLi9wcm90b19yZWNvcmQnO1xuaW1wb3J0IHtDb2RlZ2VuTmFtZVV0aWwsIHNhbml0aXplTmFtZX0gZnJvbSAnLi9jb2RlZ2VuX25hbWVfdXRpbCc7XG5pbXBvcnQge0NvZGVnZW5Mb2dpY1V0aWx9IGZyb20gJy4vY29kZWdlbl9sb2dpY191dGlsJztcbmltcG9ydCB7Y29kaWZ5fSBmcm9tICcuL2NvZGVnZW5fZmFjYWRlJztcbmltcG9ydCB7RXZlbnRCaW5kaW5nfSBmcm9tICcuL2V2ZW50X2JpbmRpbmcnO1xuaW1wb3J0IHtCaW5kaW5nVGFyZ2V0fSBmcm9tICcuL2JpbmRpbmdfcmVjb3JkJztcbmltcG9ydCB7Q2hhbmdlRGV0ZWN0b3JHZW5Db25maWcsIENoYW5nZURldGVjdG9yRGVmaW5pdGlvbn0gZnJvbSAnLi9pbnRlcmZhY2VzJztcbmltcG9ydCB7Q2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIENoYW5nZURldGVjdG9yU3RhdGV9IGZyb20gJy4vY29uc3RhbnRzJztcbmltcG9ydCB7Y3JlYXRlUHJvcGVydHlSZWNvcmRzLCBjcmVhdGVFdmVudFJlY29yZHN9IGZyb20gJy4vcHJvdG9fY2hhbmdlX2RldGVjdG9yJztcblxuLyoqXG4gKiBUaGUgY29kZSBnZW5lcmF0b3IgdGFrZXMgYSBsaXN0IG9mIHByb3RvIHJlY29yZHMgYW5kIGNyZWF0ZXMgYSBmdW5jdGlvbi9jbGFzc1xuICogdGhhdCBcImVtdWxhdGVzXCIgd2hhdCB0aGUgZGV2ZWxvcGVyIHdvdWxkIHdyaXRlIGJ5IGhhbmQgdG8gaW1wbGVtZW50IHRoZSBzYW1lXG4gKiBraW5kIG9mIGJlaGF2aW91ci5cbiAqXG4gKiBUaGlzIGNvZGUgc2hvdWxkIGJlIGtlcHQgaW4gc3luYyB3aXRoIHRoZSBEYXJ0IHRyYW5zZm9ybWVyJ3NcbiAqIGBhbmd1bGFyMi50cmFuc2Zvcm0udGVtcGxhdGVfY29tcGlsZXIuY2hhbmdlX2RldGVjdG9yX2NvZGVnZW5gIGxpYnJhcnkuIElmIHlvdSBtYWtlIHVwZGF0ZXNcbiAqIGhlcmUsIHBsZWFzZSBtYWtlIGVxdWl2YWxlbnQgY2hhbmdlcyB0aGVyZS5cbiovXG5jb25zdCBJU19DSEFOR0VEX0xPQ0FMID0gXCJpc0NoYW5nZWRcIjtcbmNvbnN0IENIQU5HRVNfTE9DQUwgPSBcImNoYW5nZXNcIjtcblxuZXhwb3J0IGNsYXNzIENoYW5nZURldGVjdG9ySklUR2VuZXJhdG9yIHtcbiAgcHJpdmF0ZSBfbG9naWM6IENvZGVnZW5Mb2dpY1V0aWw7XG4gIHByaXZhdGUgX25hbWVzOiBDb2RlZ2VuTmFtZVV0aWw7XG4gIHByaXZhdGUgX2VuZE9mQmxvY2tJZHhzOiBudW1iZXJbXTtcbiAgcHJpdmF0ZSBpZDogc3RyaW5nO1xuICBwcml2YXRlIGNoYW5nZURldGVjdGlvblN0cmF0ZWd5OiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneTtcbiAgcHJpdmF0ZSByZWNvcmRzOiBQcm90b1JlY29yZFtdO1xuICBwcml2YXRlIHByb3BlcnR5QmluZGluZ1RhcmdldHM6IEJpbmRpbmdUYXJnZXRbXTtcbiAgcHJpdmF0ZSBldmVudEJpbmRpbmdzOiBFdmVudEJpbmRpbmdbXTtcbiAgcHJpdmF0ZSBkaXJlY3RpdmVSZWNvcmRzOiBhbnlbXTtcbiAgcHJpdmF0ZSBnZW5Db25maWc6IENoYW5nZURldGVjdG9yR2VuQ29uZmlnO1xuICB0eXBlTmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKGRlZmluaXRpb246IENoYW5nZURldGVjdG9yRGVmaW5pdGlvbiwgcHJpdmF0ZSBjaGFuZ2VEZXRlY3Rpb25VdGlsVmFyTmFtZTogc3RyaW5nLFxuICAgICAgICAgICAgICBwcml2YXRlIGFic3RyYWN0Q2hhbmdlRGV0ZWN0b3JWYXJOYW1lOiBzdHJpbmcsXG4gICAgICAgICAgICAgIHByaXZhdGUgY2hhbmdlRGV0ZWN0b3JTdGF0ZVZhck5hbWU6IHN0cmluZykge1xuICAgIHZhciBwcm9wZXJ0eUJpbmRpbmdSZWNvcmRzID0gY3JlYXRlUHJvcGVydHlSZWNvcmRzKGRlZmluaXRpb24pO1xuICAgIHZhciBldmVudEJpbmRpbmdSZWNvcmRzID0gY3JlYXRlRXZlbnRSZWNvcmRzKGRlZmluaXRpb24pO1xuICAgIHZhciBwcm9wZXJ0eUJpbmRpbmdUYXJnZXRzID0gZGVmaW5pdGlvbi5iaW5kaW5nUmVjb3Jkcy5tYXAoYiA9PiBiLnRhcmdldCk7XG4gICAgdGhpcy5pZCA9IGRlZmluaXRpb24uaWQ7XG4gICAgdGhpcy5jaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSA9IGRlZmluaXRpb24uc3RyYXRlZ3k7XG4gICAgdGhpcy5nZW5Db25maWcgPSBkZWZpbml0aW9uLmdlbkNvbmZpZztcblxuICAgIHRoaXMucmVjb3JkcyA9IHByb3BlcnR5QmluZGluZ1JlY29yZHM7XG4gICAgdGhpcy5wcm9wZXJ0eUJpbmRpbmdUYXJnZXRzID0gcHJvcGVydHlCaW5kaW5nVGFyZ2V0cztcbiAgICB0aGlzLmV2ZW50QmluZGluZ3MgPSBldmVudEJpbmRpbmdSZWNvcmRzO1xuICAgIHRoaXMuZGlyZWN0aXZlUmVjb3JkcyA9IGRlZmluaXRpb24uZGlyZWN0aXZlUmVjb3JkcztcbiAgICB0aGlzLl9uYW1lcyA9IG5ldyBDb2RlZ2VuTmFtZVV0aWwodGhpcy5yZWNvcmRzLCB0aGlzLmV2ZW50QmluZGluZ3MsIHRoaXMuZGlyZWN0aXZlUmVjb3JkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jaGFuZ2VEZXRlY3Rpb25VdGlsVmFyTmFtZSk7XG4gICAgdGhpcy5fbG9naWMgPVxuICAgICAgICBuZXcgQ29kZWdlbkxvZ2ljVXRpbCh0aGlzLl9uYW1lcywgdGhpcy5jaGFuZ2VEZXRlY3Rpb25VdGlsVmFyTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jaGFuZ2VEZXRlY3RvclN0YXRlVmFyTmFtZSwgdGhpcy5jaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSk7XG4gICAgdGhpcy50eXBlTmFtZSA9IHNhbml0aXplTmFtZShgQ2hhbmdlRGV0ZWN0b3JfJHt0aGlzLmlkfWApO1xuICB9XG5cbiAgZ2VuZXJhdGUoKTogRnVuY3Rpb24ge1xuICAgIHZhciBmYWN0b3J5U291cmNlID0gYFxuICAgICAgJHt0aGlzLmdlbmVyYXRlU291cmNlKCl9XG4gICAgICByZXR1cm4gZnVuY3Rpb24oZGlzcGF0Y2hlcikge1xuICAgICAgICByZXR1cm4gbmV3ICR7dGhpcy50eXBlTmFtZX0oZGlzcGF0Y2hlcik7XG4gICAgICB9XG4gICAgYDtcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKHRoaXMuYWJzdHJhY3RDaGFuZ2VEZXRlY3RvclZhck5hbWUsIHRoaXMuY2hhbmdlRGV0ZWN0aW9uVXRpbFZhck5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNoYW5nZURldGVjdG9yU3RhdGVWYXJOYW1lLCBmYWN0b3J5U291cmNlKShcbiAgICAgICAgQWJzdHJhY3RDaGFuZ2VEZXRlY3RvciwgQ2hhbmdlRGV0ZWN0aW9uVXRpbCwgQ2hhbmdlRGV0ZWN0b3JTdGF0ZSk7XG4gIH1cblxuICBnZW5lcmF0ZVNvdXJjZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBgXG4gICAgICB2YXIgJHt0aGlzLnR5cGVOYW1lfSA9IGZ1bmN0aW9uICR7dGhpcy50eXBlTmFtZX0oZGlzcGF0Y2hlcikge1xuICAgICAgICAke3RoaXMuYWJzdHJhY3RDaGFuZ2VEZXRlY3RvclZhck5hbWV9LmNhbGwoXG4gICAgICAgICAgICB0aGlzLCAke0pTT04uc3RyaW5naWZ5KHRoaXMuaWQpfSwgZGlzcGF0Y2hlciwgJHt0aGlzLnJlY29yZHMubGVuZ3RofSxcbiAgICAgICAgICAgICR7dGhpcy50eXBlTmFtZX0uZ2VuX3Byb3BlcnR5QmluZGluZ1RhcmdldHMsICR7dGhpcy50eXBlTmFtZX0uZ2VuX2RpcmVjdGl2ZUluZGljZXMsXG4gICAgICAgICAgICAke2NvZGlmeSh0aGlzLmNoYW5nZURldGVjdGlvblN0cmF0ZWd5KX0pO1xuICAgICAgICB0aGlzLmRlaHlkcmF0ZURpcmVjdGl2ZXMoZmFsc2UpO1xuICAgICAgfVxuXG4gICAgICAke3RoaXMudHlwZU5hbWV9LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoJHt0aGlzLmFic3RyYWN0Q2hhbmdlRGV0ZWN0b3JWYXJOYW1lfS5wcm90b3R5cGUpO1xuXG4gICAgICAke3RoaXMudHlwZU5hbWV9LnByb3RvdHlwZS5kZXRlY3RDaGFuZ2VzSW5SZWNvcmRzSW50ZXJuYWwgPSBmdW5jdGlvbih0aHJvd09uQ2hhbmdlKSB7XG4gICAgICAgICR7dGhpcy5fbmFtZXMuZ2VuSW5pdExvY2FscygpfVxuICAgICAgICB2YXIgJHtJU19DSEFOR0VEX0xPQ0FMfSA9IGZhbHNlO1xuICAgICAgICB2YXIgJHtDSEFOR0VTX0xPQ0FMfSA9IG51bGw7XG5cbiAgICAgICAgJHt0aGlzLl9nZW5BbGxSZWNvcmRzKHRoaXMucmVjb3Jkcyl9XG4gICAgICB9XG5cbiAgICAgICR7dGhpcy5fbWF5YmVHZW5IYW5kbGVFdmVudEludGVybmFsKCl9XG5cbiAgICAgICR7dGhpcy5fbWF5YmVHZW5BZnRlckNvbnRlbnRMaWZlY3ljbGVDYWxsYmFja3MoKX1cblxuICAgICAgJHt0aGlzLl9tYXliZUdlbkFmdGVyVmlld0xpZmVjeWNsZUNhbGxiYWNrcygpfVxuXG4gICAgICAke3RoaXMuX21heWJlR2VuSHlkcmF0ZURpcmVjdGl2ZXMoKX1cblxuICAgICAgJHt0aGlzLl9tYXliZUdlbkRlaHlkcmF0ZURpcmVjdGl2ZXMoKX1cblxuICAgICAgJHt0aGlzLl9nZW5Qcm9wZXJ0eUJpbmRpbmdUYXJnZXRzKCl9XG5cbiAgICAgICR7dGhpcy5fZ2VuRGlyZWN0aXZlSW5kaWNlcygpfVxuICAgIGA7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZW5Qcm9wZXJ0eUJpbmRpbmdUYXJnZXRzKCk6IHN0cmluZyB7XG4gICAgdmFyIHRhcmdldHMgPSB0aGlzLl9sb2dpYy5nZW5Qcm9wZXJ0eUJpbmRpbmdUYXJnZXRzKHRoaXMucHJvcGVydHlCaW5kaW5nVGFyZ2V0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nZW5Db25maWcuZ2VuRGVidWdJbmZvKTtcbiAgICByZXR1cm4gYCR7dGhpcy50eXBlTmFtZX0uZ2VuX3Byb3BlcnR5QmluZGluZ1RhcmdldHMgPSAke3RhcmdldHN9O2A7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZW5EaXJlY3RpdmVJbmRpY2VzKCk6IHN0cmluZyB7XG4gICAgdmFyIGluZGljZXMgPSB0aGlzLl9sb2dpYy5nZW5EaXJlY3RpdmVJbmRpY2VzKHRoaXMuZGlyZWN0aXZlUmVjb3Jkcyk7XG4gICAgcmV0dXJuIGAke3RoaXMudHlwZU5hbWV9Lmdlbl9kaXJlY3RpdmVJbmRpY2VzID0gJHtpbmRpY2VzfTtgO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbWF5YmVHZW5IYW5kbGVFdmVudEludGVybmFsKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZXZlbnRCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB2YXIgaGFuZGxlcnMgPSB0aGlzLmV2ZW50QmluZGluZ3MubWFwKGViID0+IHRoaXMuX2dlbkV2ZW50QmluZGluZyhlYikpLmpvaW4oXCJcXG5cIik7XG4gICAgICByZXR1cm4gYFxuICAgICAgICAke3RoaXMudHlwZU5hbWV9LnByb3RvdHlwZS5oYW5kbGVFdmVudEludGVybmFsID0gZnVuY3Rpb24oZXZlbnROYW1lLCBlbEluZGV4LCBsb2NhbHMpIHtcbiAgICAgICAgICB2YXIgJHt0aGlzLl9uYW1lcy5nZXRQcmV2ZW50RGVmYXVsdEFjY2Vzb3IoKX0gPSBmYWxzZTtcbiAgICAgICAgICAke3RoaXMuX25hbWVzLmdlbkluaXRFdmVudExvY2FscygpfVxuICAgICAgICAgICR7aGFuZGxlcnN9XG4gICAgICAgICAgcmV0dXJuICR7dGhpcy5fbmFtZXMuZ2V0UHJldmVudERlZmF1bHRBY2Nlc29yKCl9O1xuICAgICAgICB9XG4gICAgICBgO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZ2VuRXZlbnRCaW5kaW5nKGViOiBFdmVudEJpbmRpbmcpOiBzdHJpbmcge1xuICAgIGxldCBjb2RlczogU3RyaW5nW10gPSBbXTtcbiAgICB0aGlzLl9lbmRPZkJsb2NrSWR4cyA9IFtdO1xuXG4gICAgTGlzdFdyYXBwZXIuZm9yRWFjaFdpdGhJbmRleChlYi5yZWNvcmRzLCAociwgaSkgPT4ge1xuICAgICAgbGV0IGNvZGU7XG5cbiAgICAgIGlmIChyLmlzQ29uZGl0aW9uYWxTa2lwUmVjb3JkKCkpIHtcbiAgICAgICAgY29kZSA9IHRoaXMuX2dlbkNvbmRpdGlvbmFsU2tpcChyLCB0aGlzLl9uYW1lcy5nZXRFdmVudExvY2FsTmFtZShlYiwgaSkpO1xuICAgICAgfSBlbHNlIGlmIChyLmlzVW5jb25kaXRpb25hbFNraXBSZWNvcmQoKSkge1xuICAgICAgICBjb2RlID0gdGhpcy5fZ2VuVW5jb25kaXRpb25hbFNraXAocik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb2RlID0gdGhpcy5fZ2VuRXZlbnRCaW5kaW5nRXZhbChlYiwgcik7XG4gICAgICB9XG5cbiAgICAgIGNvZGUgKz0gdGhpcy5fZ2VuRW5kT2ZTa2lwQmxvY2soaSk7XG5cbiAgICAgIGNvZGVzLnB1c2goY29kZSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYFxuICAgIGlmIChldmVudE5hbWUgPT09IFwiJHtlYi5ldmVudE5hbWV9XCIgJiYgZWxJbmRleCA9PT0gJHtlYi5lbEluZGV4fSkge1xuICAgICAgJHtjb2Rlcy5qb2luKFwiXFxuXCIpfVxuICAgIH1gO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZ2VuRXZlbnRCaW5kaW5nRXZhbChlYjogRXZlbnRCaW5kaW5nLCByOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgaWYgKHIubGFzdEluQmluZGluZykge1xuICAgICAgdmFyIGV2YWxSZWNvcmQgPSB0aGlzLl9sb2dpYy5nZW5FdmVudEJpbmRpbmdFdmFsVmFsdWUoZWIsIHIpO1xuICAgICAgdmFyIG1hcmtQYXRoID0gdGhpcy5fZ2VuTWFya1BhdGhUb1Jvb3RBc0NoZWNrT25jZShyKTtcbiAgICAgIHZhciBwcmV2RGVmYXVsdCA9IHRoaXMuX2dlblVwZGF0ZVByZXZlbnREZWZhdWx0KGViLCByKTtcbiAgICAgIHJldHVybiBgJHtldmFsUmVjb3JkfVxcbiR7bWFya1BhdGh9XFxuJHtwcmV2RGVmYXVsdH1gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fbG9naWMuZ2VuRXZlbnRCaW5kaW5nRXZhbFZhbHVlKGViLCByKTtcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZW5NYXJrUGF0aFRvUm9vdEFzQ2hlY2tPbmNlKHI6IFByb3RvUmVjb3JkKTogc3RyaW5nIHtcbiAgICB2YXIgYnIgPSByLmJpbmRpbmdSZWNvcmQ7XG4gICAgaWYgKGJyLmlzRGVmYXVsdENoYW5nZURldGVjdGlvbigpKSB7XG4gICAgICByZXR1cm4gXCJcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGAke3RoaXMuX25hbWVzLmdldERldGVjdG9yTmFtZShici5kaXJlY3RpdmVSZWNvcmQuZGlyZWN0aXZlSW5kZXgpfS5tYXJrUGF0aFRvUm9vdEFzQ2hlY2tPbmNlKCk7YDtcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZW5VcGRhdGVQcmV2ZW50RGVmYXVsdChlYjogRXZlbnRCaW5kaW5nLCByOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgdmFyIGxvY2FsID0gdGhpcy5fbmFtZXMuZ2V0RXZlbnRMb2NhbE5hbWUoZWIsIHIuc2VsZkluZGV4KTtcbiAgICByZXR1cm4gYGlmICgke2xvY2FsfSA9PT0gZmFsc2UpIHsgJHt0aGlzLl9uYW1lcy5nZXRQcmV2ZW50RGVmYXVsdEFjY2Vzb3IoKX0gPSB0cnVlfTtgO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbWF5YmVHZW5EZWh5ZHJhdGVEaXJlY3RpdmVzKCk6IHN0cmluZyB7XG4gICAgdmFyIGRlc3Ryb3lQaXBlc0NvZGUgPSB0aGlzLl9uYW1lcy5nZW5QaXBlT25EZXN0cm95KCk7XG4gICAgaWYgKGRlc3Ryb3lQaXBlc0NvZGUpIHtcbiAgICAgIGRlc3Ryb3lQaXBlc0NvZGUgPSBgaWYgKGRlc3Ryb3lQaXBlcykgeyAke2Rlc3Ryb3lQaXBlc0NvZGV9IH1gO1xuICAgIH1cbiAgICB2YXIgZGVoeWRyYXRlRmllbGRzQ29kZSA9IHRoaXMuX25hbWVzLmdlbkRlaHlkcmF0ZUZpZWxkcygpO1xuICAgIGlmICghZGVzdHJveVBpcGVzQ29kZSAmJiAhZGVoeWRyYXRlRmllbGRzQ29kZSkgcmV0dXJuICcnO1xuICAgIHJldHVybiBgJHt0aGlzLnR5cGVOYW1lfS5wcm90b3R5cGUuZGVoeWRyYXRlRGlyZWN0aXZlcyA9IGZ1bmN0aW9uKGRlc3Ryb3lQaXBlcykge1xuICAgICAgICAke2Rlc3Ryb3lQaXBlc0NvZGV9XG4gICAgICAgICR7ZGVoeWRyYXRlRmllbGRzQ29kZX1cbiAgICB9YDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX21heWJlR2VuSHlkcmF0ZURpcmVjdGl2ZXMoKTogc3RyaW5nIHtcbiAgICB2YXIgaHlkcmF0ZURpcmVjdGl2ZXNDb2RlID0gdGhpcy5fbG9naWMuZ2VuSHlkcmF0ZURpcmVjdGl2ZXModGhpcy5kaXJlY3RpdmVSZWNvcmRzKTtcbiAgICB2YXIgaHlkcmF0ZURldGVjdG9yc0NvZGUgPSB0aGlzLl9sb2dpYy5nZW5IeWRyYXRlRGV0ZWN0b3JzKHRoaXMuZGlyZWN0aXZlUmVjb3Jkcyk7XG4gICAgaWYgKCFoeWRyYXRlRGlyZWN0aXZlc0NvZGUgJiYgIWh5ZHJhdGVEZXRlY3RvcnNDb2RlKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIGAke3RoaXMudHlwZU5hbWV9LnByb3RvdHlwZS5oeWRyYXRlRGlyZWN0aXZlcyA9IGZ1bmN0aW9uKGRpcmVjdGl2ZXMpIHtcbiAgICAgICR7aHlkcmF0ZURpcmVjdGl2ZXNDb2RlfVxuICAgICAgJHtoeWRyYXRlRGV0ZWN0b3JzQ29kZX1cbiAgICB9YDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX21heWJlR2VuQWZ0ZXJDb250ZW50TGlmZWN5Y2xlQ2FsbGJhY2tzKCk6IHN0cmluZyB7XG4gICAgdmFyIG5vdGlmaWNhdGlvbnMgPSB0aGlzLl9sb2dpYy5nZW5Db250ZW50TGlmZWN5Y2xlQ2FsbGJhY2tzKHRoaXMuZGlyZWN0aXZlUmVjb3Jkcyk7XG4gICAgaWYgKG5vdGlmaWNhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgdmFyIGRpcmVjdGl2ZU5vdGlmaWNhdGlvbnMgPSBub3RpZmljYXRpb25zLmpvaW4oXCJcXG5cIik7XG4gICAgICByZXR1cm4gYFxuICAgICAgICAke3RoaXMudHlwZU5hbWV9LnByb3RvdHlwZS5hZnRlckNvbnRlbnRMaWZlY3ljbGVDYWxsYmFja3NJbnRlcm5hbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICR7ZGlyZWN0aXZlTm90aWZpY2F0aW9uc31cbiAgICAgICAgfVxuICAgICAgYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX21heWJlR2VuQWZ0ZXJWaWV3TGlmZWN5Y2xlQ2FsbGJhY2tzKCk6IHN0cmluZyB7XG4gICAgdmFyIG5vdGlmaWNhdGlvbnMgPSB0aGlzLl9sb2dpYy5nZW5WaWV3TGlmZWN5Y2xlQ2FsbGJhY2tzKHRoaXMuZGlyZWN0aXZlUmVjb3Jkcyk7XG4gICAgaWYgKG5vdGlmaWNhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgdmFyIGRpcmVjdGl2ZU5vdGlmaWNhdGlvbnMgPSBub3RpZmljYXRpb25zLmpvaW4oXCJcXG5cIik7XG4gICAgICByZXR1cm4gYFxuICAgICAgICAke3RoaXMudHlwZU5hbWV9LnByb3RvdHlwZS5hZnRlclZpZXdMaWZlY3ljbGVDYWxsYmFja3NJbnRlcm5hbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICR7ZGlyZWN0aXZlTm90aWZpY2F0aW9uc31cbiAgICAgICAgfVxuICAgICAgYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dlbkFsbFJlY29yZHMocnM6IFByb3RvUmVjb3JkW10pOiBzdHJpbmcge1xuICAgIHZhciBjb2RlczogU3RyaW5nW10gPSBbXTtcbiAgICB0aGlzLl9lbmRPZkJsb2NrSWR4cyA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBycy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IGNvZGU7XG4gICAgICBsZXQgciA9IHJzW2ldO1xuXG4gICAgICBpZiAoci5pc0xpZmVDeWNsZVJlY29yZCgpKSB7XG4gICAgICAgIGNvZGUgPSB0aGlzLl9nZW5EaXJlY3RpdmVMaWZlY3ljbGUocik7XG4gICAgICB9IGVsc2UgaWYgKHIuaXNQaXBlUmVjb3JkKCkpIHtcbiAgICAgICAgY29kZSA9IHRoaXMuX2dlblBpcGVDaGVjayhyKTtcbiAgICAgIH0gZWxzZSBpZiAoci5pc0NvbmRpdGlvbmFsU2tpcFJlY29yZCgpKSB7XG4gICAgICAgIGNvZGUgPSB0aGlzLl9nZW5Db25kaXRpb25hbFNraXAociwgdGhpcy5fbmFtZXMuZ2V0TG9jYWxOYW1lKHIuY29udGV4dEluZGV4KSk7XG4gICAgICB9IGVsc2UgaWYgKHIuaXNVbmNvbmRpdGlvbmFsU2tpcFJlY29yZCgpKSB7XG4gICAgICAgIGNvZGUgPSB0aGlzLl9nZW5VbmNvbmRpdGlvbmFsU2tpcChyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvZGUgPSB0aGlzLl9nZW5SZWZlcmVuY2VDaGVjayhyKTtcbiAgICAgIH1cblxuICAgICAgY29kZSA9IGBcbiAgICAgICAgJHt0aGlzLl9tYXliZUZpcnN0SW5CaW5kaW5nKHIpfVxuICAgICAgICAke2NvZGV9XG4gICAgICAgICR7dGhpcy5fbWF5YmVHZW5MYXN0SW5EaXJlY3RpdmUocil9XG4gICAgICAgICR7dGhpcy5fZ2VuRW5kT2ZTa2lwQmxvY2soaSl9XG4gICAgICBgO1xuXG4gICAgICBjb2Rlcy5wdXNoKGNvZGUpO1xuICAgIH1cblxuICAgIHJldHVybiBjb2Rlcy5qb2luKFwiXFxuXCIpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZ2VuQ29uZGl0aW9uYWxTa2lwKHI6IFByb3RvUmVjb3JkLCBjb25kaXRpb246IHN0cmluZyk6IHN0cmluZyB7XG4gICAgbGV0IG1heWJlTmVnYXRlID0gci5tb2RlID09PSBSZWNvcmRUeXBlLlNraXBSZWNvcmRzSWYgPyAnIScgOiAnJztcbiAgICB0aGlzLl9lbmRPZkJsb2NrSWR4cy5wdXNoKHIuZml4ZWRBcmdzWzBdIC0gMSk7XG5cbiAgICByZXR1cm4gYGlmICgke21heWJlTmVnYXRlfSR7Y29uZGl0aW9ufSkge2A7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZW5VbmNvbmRpdGlvbmFsU2tpcChyOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgdGhpcy5fZW5kT2ZCbG9ja0lkeHMucG9wKCk7XG4gICAgdGhpcy5fZW5kT2ZCbG9ja0lkeHMucHVzaChyLmZpeGVkQXJnc1swXSAtIDEpO1xuICAgIHJldHVybiBgfSBlbHNlIHtgO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZ2VuRW5kT2ZTa2lwQmxvY2socHJvdG9JbmRleDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBpZiAoIUxpc3RXcmFwcGVyLmlzRW1wdHkodGhpcy5fZW5kT2ZCbG9ja0lkeHMpKSB7XG4gICAgICBsZXQgZW5kT2ZCbG9jayA9IExpc3RXcmFwcGVyLmxhc3QodGhpcy5fZW5kT2ZCbG9ja0lkeHMpO1xuICAgICAgaWYgKHByb3RvSW5kZXggPT09IGVuZE9mQmxvY2spIHtcbiAgICAgICAgdGhpcy5fZW5kT2ZCbG9ja0lkeHMucG9wKCk7XG4gICAgICAgIHJldHVybiAnfSc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZ2VuRGlyZWN0aXZlTGlmZWN5Y2xlKHI6IFByb3RvUmVjb3JkKTogc3RyaW5nIHtcbiAgICBpZiAoci5uYW1lID09PSBcIkRvQ2hlY2tcIikge1xuICAgICAgcmV0dXJuIHRoaXMuX2dlbk9uQ2hlY2socik7XG4gICAgfSBlbHNlIGlmIChyLm5hbWUgPT09IFwiT25Jbml0XCIpIHtcbiAgICAgIHJldHVybiB0aGlzLl9nZW5PbkluaXQocik7XG4gICAgfSBlbHNlIGlmIChyLm5hbWUgPT09IFwiT25DaGFuZ2VzXCIpIHtcbiAgICAgIHJldHVybiB0aGlzLl9nZW5PbkNoYW5nZShyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEJhc2VFeGNlcHRpb24oYFVua25vd24gbGlmZWN5Y2xlIGV2ZW50ICcke3IubmFtZX0nYCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZ2VuUGlwZUNoZWNrKHI6IFByb3RvUmVjb3JkKTogc3RyaW5nIHtcbiAgICB2YXIgY29udGV4dCA9IHRoaXMuX25hbWVzLmdldExvY2FsTmFtZShyLmNvbnRleHRJbmRleCk7XG4gICAgdmFyIGFyZ1N0cmluZyA9IHIuYXJncy5tYXAoKGFyZykgPT4gdGhpcy5fbmFtZXMuZ2V0TG9jYWxOYW1lKGFyZykpLmpvaW4oXCIsIFwiKTtcblxuICAgIHZhciBvbGRWYWx1ZSA9IHRoaXMuX25hbWVzLmdldEZpZWxkTmFtZShyLnNlbGZJbmRleCk7XG4gICAgdmFyIG5ld1ZhbHVlID0gdGhpcy5fbmFtZXMuZ2V0TG9jYWxOYW1lKHIuc2VsZkluZGV4KTtcblxuICAgIHZhciBwaXBlID0gdGhpcy5fbmFtZXMuZ2V0UGlwZU5hbWUoci5zZWxmSW5kZXgpO1xuICAgIHZhciBwaXBlTmFtZSA9IHIubmFtZTtcblxuICAgIHZhciBpbml0ID0gYFxuICAgICAgaWYgKCR7cGlwZX0gPT09ICR7dGhpcy5jaGFuZ2VEZXRlY3Rpb25VdGlsVmFyTmFtZX0udW5pbml0aWFsaXplZCkge1xuICAgICAgICAke3BpcGV9ID0gJHt0aGlzLl9uYW1lcy5nZXRQaXBlc0FjY2Vzc29yTmFtZSgpfS5nZXQoJyR7cGlwZU5hbWV9Jyk7XG4gICAgICB9XG4gICAgYDtcbiAgICB2YXIgcmVhZCA9IGAke25ld1ZhbHVlfSA9ICR7cGlwZX0ucGlwZS50cmFuc2Zvcm0oJHtjb250ZXh0fSwgWyR7YXJnU3RyaW5nfV0pO2A7XG5cbiAgICB2YXIgY29udGV4T3JBcmdDaGVjayA9IHIuYXJncy5tYXAoKGEpID0+IHRoaXMuX25hbWVzLmdldENoYW5nZU5hbWUoYSkpO1xuICAgIGNvbnRleE9yQXJnQ2hlY2sucHVzaCh0aGlzLl9uYW1lcy5nZXRDaGFuZ2VOYW1lKHIuY29udGV4dEluZGV4KSk7XG4gICAgdmFyIGNvbmRpdGlvbiA9IGAhJHtwaXBlfS5wdXJlIHx8ICgke2NvbnRleE9yQXJnQ2hlY2suam9pbihcIiB8fCBcIil9KWA7XG5cbiAgICB2YXIgY2hlY2sgPSBgXG4gICAgICBpZiAoJHt0aGlzLmNoYW5nZURldGVjdGlvblV0aWxWYXJOYW1lfS5sb29zZU5vdElkZW50aWNhbCgke29sZFZhbHVlfSwgJHtuZXdWYWx1ZX0pKSB7XG4gICAgICAgICR7bmV3VmFsdWV9ID0gJHt0aGlzLmNoYW5nZURldGVjdGlvblV0aWxWYXJOYW1lfS51bndyYXBWYWx1ZSgke25ld1ZhbHVlfSlcbiAgICAgICAgJHt0aGlzLl9nZW5DaGFuZ2VNYXJrZXIocil9XG4gICAgICAgICR7dGhpcy5fZ2VuVXBkYXRlRGlyZWN0aXZlT3JFbGVtZW50KHIpfVxuICAgICAgICAke3RoaXMuX2dlbkFkZFRvQ2hhbmdlcyhyKX1cbiAgICAgICAgJHtvbGRWYWx1ZX0gPSAke25ld1ZhbHVlfTtcbiAgICAgIH1cbiAgICBgO1xuXG4gICAgdmFyIGdlbkNvZGUgPSByLnNob3VsZEJlQ2hlY2tlZCgpID8gYCR7cmVhZH0ke2NoZWNrfWAgOiByZWFkO1xuXG4gICAgaWYgKHIuaXNVc2VkQnlPdGhlclJlY29yZCgpKSB7XG4gICAgICByZXR1cm4gYCR7aW5pdH0gaWYgKCR7Y29uZGl0aW9ufSkgeyAke2dlbkNvZGV9IH0gZWxzZSB7ICR7bmV3VmFsdWV9ID0gJHtvbGRWYWx1ZX07IH1gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYCR7aW5pdH0gaWYgKCR7Y29uZGl0aW9ufSkgeyAke2dlbkNvZGV9IH1gO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dlblJlZmVyZW5jZUNoZWNrKHI6IFByb3RvUmVjb3JkKTogc3RyaW5nIHtcbiAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLl9uYW1lcy5nZXRGaWVsZE5hbWUoci5zZWxmSW5kZXgpO1xuICAgIHZhciBuZXdWYWx1ZSA9IHRoaXMuX25hbWVzLmdldExvY2FsTmFtZShyLnNlbGZJbmRleCk7XG4gICAgdmFyIHJlYWQgPSBgXG4gICAgICAke3RoaXMuX2xvZ2ljLmdlblByb3BlcnR5QmluZGluZ0V2YWxWYWx1ZShyKX1cbiAgICBgO1xuXG4gICAgdmFyIGNoZWNrID0gYFxuICAgICAgaWYgKCR7dGhpcy5jaGFuZ2VEZXRlY3Rpb25VdGlsVmFyTmFtZX0ubG9vc2VOb3RJZGVudGljYWwoJHtvbGRWYWx1ZX0sICR7bmV3VmFsdWV9KSkge1xuICAgICAgICAke3RoaXMuX2dlbkNoYW5nZU1hcmtlcihyKX1cbiAgICAgICAgJHt0aGlzLl9nZW5VcGRhdGVEaXJlY3RpdmVPckVsZW1lbnQocil9XG4gICAgICAgICR7dGhpcy5fZ2VuQWRkVG9DaGFuZ2VzKHIpfVxuICAgICAgICAke29sZFZhbHVlfSA9ICR7bmV3VmFsdWV9O1xuICAgICAgfVxuICAgIGA7XG5cbiAgICB2YXIgZ2VuQ29kZSA9IHIuc2hvdWxkQmVDaGVja2VkKCkgPyBgJHtyZWFkfSR7Y2hlY2t9YCA6IHJlYWQ7XG5cbiAgICBpZiAoci5pc1B1cmVGdW5jdGlvbigpKSB7XG4gICAgICB2YXIgY29uZGl0aW9uID0gci5hcmdzLm1hcCgoYSkgPT4gdGhpcy5fbmFtZXMuZ2V0Q2hhbmdlTmFtZShhKSkuam9pbihcIiB8fCBcIik7XG4gICAgICBpZiAoci5pc1VzZWRCeU90aGVyUmVjb3JkKCkpIHtcbiAgICAgICAgcmV0dXJuIGBpZiAoJHtjb25kaXRpb259KSB7ICR7Z2VuQ29kZX0gfSBlbHNlIHsgJHtuZXdWYWx1ZX0gPSAke29sZFZhbHVlfTsgfWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYGlmICgke2NvbmRpdGlvbn0pIHsgJHtnZW5Db2RlfSB9YDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGdlbkNvZGU7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfZ2VuQ2hhbmdlTWFya2VyKHI6IFByb3RvUmVjb3JkKTogc3RyaW5nIHtcbiAgICByZXR1cm4gci5hcmd1bWVudFRvUHVyZUZ1bmN0aW9uID8gYCR7dGhpcy5fbmFtZXMuZ2V0Q2hhbmdlTmFtZShyLnNlbGZJbmRleCl9ID0gdHJ1ZWAgOiBgYDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dlblVwZGF0ZURpcmVjdGl2ZU9yRWxlbWVudChyOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgaWYgKCFyLmxhc3RJbkJpbmRpbmcpIHJldHVybiBcIlwiO1xuXG4gICAgdmFyIG5ld1ZhbHVlID0gdGhpcy5fbmFtZXMuZ2V0TG9jYWxOYW1lKHIuc2VsZkluZGV4KTtcbiAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLl9uYW1lcy5nZXRGaWVsZE5hbWUoci5zZWxmSW5kZXgpO1xuICAgIHZhciBub3RpZnlEZWJ1ZyA9IHRoaXMuZ2VuQ29uZmlnLmxvZ0JpbmRpbmdVcGRhdGUgPyBgdGhpcy5sb2dCaW5kaW5nVXBkYXRlKCR7bmV3VmFsdWV9KTtgIDogXCJcIjtcblxuICAgIHZhciBiciA9IHIuYmluZGluZ1JlY29yZDtcbiAgICBpZiAoYnIudGFyZ2V0LmlzRGlyZWN0aXZlKCkpIHtcbiAgICAgIHZhciBkaXJlY3RpdmVQcm9wZXJ0eSA9XG4gICAgICAgICAgYCR7dGhpcy5fbmFtZXMuZ2V0RGlyZWN0aXZlTmFtZShici5kaXJlY3RpdmVSZWNvcmQuZGlyZWN0aXZlSW5kZXgpfS4ke2JyLnRhcmdldC5uYW1lfWA7XG4gICAgICByZXR1cm4gYFxuICAgICAgICAke3RoaXMuX2dlblRocm93T25DaGFuZ2VDaGVjayhvbGRWYWx1ZSwgbmV3VmFsdWUpfVxuICAgICAgICAke2RpcmVjdGl2ZVByb3BlcnR5fSA9ICR7bmV3VmFsdWV9O1xuICAgICAgICAke25vdGlmeURlYnVnfVxuICAgICAgICAke0lTX0NIQU5HRURfTE9DQUx9ID0gdHJ1ZTtcbiAgICAgIGA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBgXG4gICAgICAgICR7dGhpcy5fZ2VuVGhyb3dPbkNoYW5nZUNoZWNrKG9sZFZhbHVlLCBuZXdWYWx1ZSl9XG4gICAgICAgIHRoaXMubm90aWZ5RGlzcGF0Y2hlcigke25ld1ZhbHVlfSk7XG4gICAgICAgICR7bm90aWZ5RGVidWd9XG4gICAgICBgO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dlblRocm93T25DaGFuZ2VDaGVjayhvbGRWYWx1ZTogc3RyaW5nLCBuZXdWYWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoYXNzZXJ0aW9uc0VuYWJsZWQoKSkge1xuICAgICAgcmV0dXJuIGBcbiAgICAgICAgaWYodGhyb3dPbkNoYW5nZSkge1xuICAgICAgICAgIHRoaXMudGhyb3dPbkNoYW5nZUVycm9yKCR7b2xkVmFsdWV9LCAke25ld1ZhbHVlfSk7XG4gICAgICAgIH1cbiAgICAgICAgYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dlbkFkZFRvQ2hhbmdlcyhyOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgdmFyIG5ld1ZhbHVlID0gdGhpcy5fbmFtZXMuZ2V0TG9jYWxOYW1lKHIuc2VsZkluZGV4KTtcbiAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLl9uYW1lcy5nZXRGaWVsZE5hbWUoci5zZWxmSW5kZXgpO1xuICAgIGlmICghci5iaW5kaW5nUmVjb3JkLmNhbGxPbkNoYW5nZXMoKSkgcmV0dXJuIFwiXCI7XG4gICAgcmV0dXJuIGAke0NIQU5HRVNfTE9DQUx9ID0gdGhpcy5hZGRDaGFuZ2UoJHtDSEFOR0VTX0xPQ0FMfSwgJHtvbGRWYWx1ZX0sICR7bmV3VmFsdWV9KTtgO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbWF5YmVGaXJzdEluQmluZGluZyhyOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgdmFyIHByZXYgPSBDaGFuZ2VEZXRlY3Rpb25VdGlsLnByb3RvQnlJbmRleCh0aGlzLnJlY29yZHMsIHIuc2VsZkluZGV4IC0gMSk7XG4gICAgdmFyIGZpcnN0SW5CaW5kaW5nID0gaXNCbGFuayhwcmV2KSB8fCBwcmV2LmJpbmRpbmdSZWNvcmQgIT09IHIuYmluZGluZ1JlY29yZDtcbiAgICByZXR1cm4gZmlyc3RJbkJpbmRpbmcgJiYgIXIuYmluZGluZ1JlY29yZC5pc0RpcmVjdGl2ZUxpZmVjeWNsZSgpID9cbiAgICAgICAgICAgICAgIGAke3RoaXMuX25hbWVzLmdldFByb3BlcnR5QmluZGluZ0luZGV4KCl9ID0gJHtyLnByb3BlcnR5QmluZGluZ0luZGV4fTtgIDpcbiAgICAgICAgICAgICAgICcnO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbWF5YmVHZW5MYXN0SW5EaXJlY3RpdmUocjogUHJvdG9SZWNvcmQpOiBzdHJpbmcge1xuICAgIGlmICghci5sYXN0SW5EaXJlY3RpdmUpIHJldHVybiBcIlwiO1xuICAgIHJldHVybiBgXG4gICAgICAke0NIQU5HRVNfTE9DQUx9ID0gbnVsbDtcbiAgICAgICR7dGhpcy5fZ2VuTm90aWZ5T25QdXNoRGV0ZWN0b3JzKHIpfVxuICAgICAgJHtJU19DSEFOR0VEX0xPQ0FMfSA9IGZhbHNlO1xuICAgIGA7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZW5PbkNoZWNrKHI6IFByb3RvUmVjb3JkKTogc3RyaW5nIHtcbiAgICB2YXIgYnIgPSByLmJpbmRpbmdSZWNvcmQ7XG4gICAgcmV0dXJuIGBpZiAoIXRocm93T25DaGFuZ2UpICR7dGhpcy5fbmFtZXMuZ2V0RGlyZWN0aXZlTmFtZShici5kaXJlY3RpdmVSZWNvcmQuZGlyZWN0aXZlSW5kZXgpfS5kb0NoZWNrKCk7YDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dlbk9uSW5pdChyOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgdmFyIGJyID0gci5iaW5kaW5nUmVjb3JkO1xuICAgIHJldHVybiBgaWYgKCF0aHJvd09uQ2hhbmdlICYmICR7dGhpcy5fbmFtZXMuZ2V0U3RhdGVOYW1lKCl9ID09PSAke3RoaXMuY2hhbmdlRGV0ZWN0b3JTdGF0ZVZhck5hbWV9Lk5ldmVyQ2hlY2tlZCkgJHt0aGlzLl9uYW1lcy5nZXREaXJlY3RpdmVOYW1lKGJyLmRpcmVjdGl2ZVJlY29yZC5kaXJlY3RpdmVJbmRleCl9Lm9uSW5pdCgpO2A7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9nZW5PbkNoYW5nZShyOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgdmFyIGJyID0gci5iaW5kaW5nUmVjb3JkO1xuICAgIHJldHVybiBgaWYgKCF0aHJvd09uQ2hhbmdlICYmICR7Q0hBTkdFU19MT0NBTH0pICR7dGhpcy5fbmFtZXMuZ2V0RGlyZWN0aXZlTmFtZShici5kaXJlY3RpdmVSZWNvcmQuZGlyZWN0aXZlSW5kZXgpfS5vbkNoYW5nZXMoJHtDSEFOR0VTX0xPQ0FMfSk7YDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2dlbk5vdGlmeU9uUHVzaERldGVjdG9ycyhyOiBQcm90b1JlY29yZCk6IHN0cmluZyB7XG4gICAgdmFyIGJyID0gci5iaW5kaW5nUmVjb3JkO1xuICAgIGlmICghci5sYXN0SW5EaXJlY3RpdmUgfHwgYnIuaXNEZWZhdWx0Q2hhbmdlRGV0ZWN0aW9uKCkpIHJldHVybiBcIlwiO1xuICAgIHZhciByZXRWYWwgPSBgXG4gICAgICBpZigke0lTX0NIQU5HRURfTE9DQUx9KSB7XG4gICAgICAgICR7dGhpcy5fbmFtZXMuZ2V0RGV0ZWN0b3JOYW1lKGJyLmRpcmVjdGl2ZVJlY29yZC5kaXJlY3RpdmVJbmRleCl9Lm1hcmtBc0NoZWNrT25jZSgpO1xuICAgICAgfVxuICAgIGA7XG4gICAgcmV0dXJuIHJldFZhbDtcbiAgfVxufVxuIl19