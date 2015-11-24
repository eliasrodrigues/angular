import { isPresent } from 'angular2/src/facade/lang';
export class TextAst {
    constructor(value, ngContentIndex, sourceSpan) {
        this.value = value;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) { return visitor.visitText(this, context); }
}
export class BoundTextAst {
    constructor(value, ngContentIndex, sourceSpan) {
        this.value = value;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitBoundText(this, context);
    }
}
export class AttrAst {
    constructor(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) { return visitor.visitAttr(this, context); }
}
export class BoundElementPropertyAst {
    constructor(name, type, value, unit, sourceSpan) {
        this.name = name;
        this.type = type;
        this.value = value;
        this.unit = unit;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitElementProperty(this, context);
    }
}
export class BoundEventAst {
    constructor(name, target, handler, sourceSpan) {
        this.name = name;
        this.target = target;
        this.handler = handler;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitEvent(this, context);
    }
    get fullName() {
        if (isPresent(this.target)) {
            return `${this.target}:${this.name}`;
        }
        else {
            return this.name;
        }
    }
}
export class VariableAst {
    constructor(name, value, sourceSpan) {
        this.name = name;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitVariable(this, context);
    }
}
export class ElementAst {
    constructor(name, attrs, inputs, outputs, exportAsVars, directives, children, ngContentIndex, sourceSpan) {
        this.name = name;
        this.attrs = attrs;
        this.inputs = inputs;
        this.outputs = outputs;
        this.exportAsVars = exportAsVars;
        this.directives = directives;
        this.children = children;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitElement(this, context);
    }
    isBound() {
        return (this.inputs.length > 0 || this.outputs.length > 0 || this.exportAsVars.length > 0 ||
            this.directives.length > 0);
    }
    getComponent() {
        return this.directives.length > 0 && this.directives[0].directive.isComponent ?
            this.directives[0].directive :
            null;
    }
}
export class EmbeddedTemplateAst {
    constructor(attrs, outputs, vars, directives, children, ngContentIndex, sourceSpan) {
        this.attrs = attrs;
        this.outputs = outputs;
        this.vars = vars;
        this.directives = directives;
        this.children = children;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitEmbeddedTemplate(this, context);
    }
}
export class BoundDirectivePropertyAst {
    constructor(directiveName, templateName, value, sourceSpan) {
        this.directiveName = directiveName;
        this.templateName = templateName;
        this.value = value;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitDirectiveProperty(this, context);
    }
}
export class DirectiveAst {
    constructor(directive, inputs, hostProperties, hostEvents, exportAsVars, sourceSpan) {
        this.directive = directive;
        this.inputs = inputs;
        this.hostProperties = hostProperties;
        this.hostEvents = hostEvents;
        this.exportAsVars = exportAsVars;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitDirective(this, context);
    }
}
export class NgContentAst {
    constructor(index, ngContentIndex, sourceSpan) {
        this.index = index;
        this.ngContentIndex = ngContentIndex;
        this.sourceSpan = sourceSpan;
    }
    visit(visitor, context) {
        return visitor.visitNgContent(this, context);
    }
}
export var PropertyBindingType;
(function (PropertyBindingType) {
    PropertyBindingType[PropertyBindingType["Property"] = 0] = "Property";
    PropertyBindingType[PropertyBindingType["Attribute"] = 1] = "Attribute";
    PropertyBindingType[PropertyBindingType["Class"] = 2] = "Class";
    PropertyBindingType[PropertyBindingType["Style"] = 3] = "Style";
})(PropertyBindingType || (PropertyBindingType = {}));
export function templateVisitAll(visitor, asts, context = null) {
    var result = [];
    asts.forEach(ast => {
        var astResult = ast.visit(visitor, context);
        if (isPresent(astResult)) {
            result.push(astResult);
        }
    });
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGVfYXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYW5ndWxhcjIvc3JjL2NvbXBpbGVyL3RlbXBsYXRlX2FzdC50cyJdLCJuYW1lcyI6WyJUZXh0QXN0IiwiVGV4dEFzdC5jb25zdHJ1Y3RvciIsIlRleHRBc3QudmlzaXQiLCJCb3VuZFRleHRBc3QiLCJCb3VuZFRleHRBc3QuY29uc3RydWN0b3IiLCJCb3VuZFRleHRBc3QudmlzaXQiLCJBdHRyQXN0IiwiQXR0ckFzdC5jb25zdHJ1Y3RvciIsIkF0dHJBc3QudmlzaXQiLCJCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCIsIkJvdW5kRWxlbWVudFByb3BlcnR5QXN0LmNvbnN0cnVjdG9yIiwiQm91bmRFbGVtZW50UHJvcGVydHlBc3QudmlzaXQiLCJCb3VuZEV2ZW50QXN0IiwiQm91bmRFdmVudEFzdC5jb25zdHJ1Y3RvciIsIkJvdW5kRXZlbnRBc3QudmlzaXQiLCJCb3VuZEV2ZW50QXN0LmZ1bGxOYW1lIiwiVmFyaWFibGVBc3QiLCJWYXJpYWJsZUFzdC5jb25zdHJ1Y3RvciIsIlZhcmlhYmxlQXN0LnZpc2l0IiwiRWxlbWVudEFzdCIsIkVsZW1lbnRBc3QuY29uc3RydWN0b3IiLCJFbGVtZW50QXN0LnZpc2l0IiwiRWxlbWVudEFzdC5pc0JvdW5kIiwiRWxlbWVudEFzdC5nZXRDb21wb25lbnQiLCJFbWJlZGRlZFRlbXBsYXRlQXN0IiwiRW1iZWRkZWRUZW1wbGF0ZUFzdC5jb25zdHJ1Y3RvciIsIkVtYmVkZGVkVGVtcGxhdGVBc3QudmlzaXQiLCJCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0IiwiQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdC5jb25zdHJ1Y3RvciIsIkJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QudmlzaXQiLCJEaXJlY3RpdmVBc3QiLCJEaXJlY3RpdmVBc3QuY29uc3RydWN0b3IiLCJEaXJlY3RpdmVBc3QudmlzaXQiLCJOZ0NvbnRlbnRBc3QiLCJOZ0NvbnRlbnRBc3QuY29uc3RydWN0b3IiLCJOZ0NvbnRlbnRBc3QudmlzaXQiLCJQcm9wZXJ0eUJpbmRpbmdUeXBlIiwidGVtcGxhdGVWaXNpdEFsbCJdLCJtYXBwaW5ncyI6Ik9BQ08sRUFBQyxTQUFTLEVBQUMsTUFBTSwwQkFBMEI7QUFTbEQ7SUFDRUEsWUFBbUJBLEtBQWFBLEVBQVNBLGNBQXNCQSxFQUM1Q0EsVUFBMkJBO1FBRDNCQyxVQUFLQSxHQUFMQSxLQUFLQSxDQUFRQTtRQUFTQSxtQkFBY0EsR0FBZEEsY0FBY0EsQ0FBUUE7UUFDNUNBLGVBQVVBLEdBQVZBLFVBQVVBLENBQWlCQTtJQUFHQSxDQUFDQTtJQUNsREQsS0FBS0EsQ0FBQ0EsT0FBMkJBLEVBQUVBLE9BQVlBLElBQVNFLE1BQU1BLENBQUNBLE9BQU9BLENBQUNBLFNBQVNBLENBQUNBLElBQUlBLEVBQUVBLE9BQU9BLENBQUNBLENBQUNBLENBQUNBLENBQUNBO0FBQ3BHRixDQUFDQTtBQUVEO0lBQ0VHLFlBQW1CQSxLQUFVQSxFQUFTQSxjQUFzQkEsRUFDekNBLFVBQTJCQTtRQUQzQkMsVUFBS0EsR0FBTEEsS0FBS0EsQ0FBS0E7UUFBU0EsbUJBQWNBLEdBQWRBLGNBQWNBLENBQVFBO1FBQ3pDQSxlQUFVQSxHQUFWQSxVQUFVQSxDQUFpQkE7SUFBR0EsQ0FBQ0E7SUFDbERELEtBQUtBLENBQUNBLE9BQTJCQSxFQUFFQSxPQUFZQTtRQUM3Q0UsTUFBTUEsQ0FBQ0EsT0FBT0EsQ0FBQ0EsY0FBY0EsQ0FBQ0EsSUFBSUEsRUFBRUEsT0FBT0EsQ0FBQ0EsQ0FBQ0E7SUFDL0NBLENBQUNBO0FBQ0hGLENBQUNBO0FBRUQ7SUFDRUcsWUFBbUJBLElBQVlBLEVBQVNBLEtBQWFBLEVBQVNBLFVBQTJCQTtRQUF0RUMsU0FBSUEsR0FBSkEsSUFBSUEsQ0FBUUE7UUFBU0EsVUFBS0EsR0FBTEEsS0FBS0EsQ0FBUUE7UUFBU0EsZUFBVUEsR0FBVkEsVUFBVUEsQ0FBaUJBO0lBQUdBLENBQUNBO0lBQzdGRCxLQUFLQSxDQUFDQSxPQUEyQkEsRUFBRUEsT0FBWUEs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InNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QVNUfSBmcm9tICdhbmd1bGFyMi9zcmMvY29yZS9jaGFuZ2VfZGV0ZWN0aW9uL2NoYW5nZV9kZXRlY3Rpb24nO1xuaW1wb3J0IHtpc1ByZXNlbnR9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvbGFuZyc7XG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YX0gZnJvbSAnLi9kaXJlY3RpdmVfbWV0YWRhdGEnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4vcGFyc2VfdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVtcGxhdGVBc3Qge1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55O1xufVxuXG5leHBvcnQgY2xhc3MgVGV4dEFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBuZ0NvbnRlbnRJbmRleDogbnVtYmVyLFxuICAgICAgICAgICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7IHJldHVybiB2aXNpdG9yLnZpc2l0VGV4dCh0aGlzLCBjb250ZXh0KTsgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmRUZXh0QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgdmFsdWU6IEFTVCwgcHVibGljIG5nQ29udGVudEluZGV4OiBudW1iZXIsXG4gICAgICAgICAgICAgIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdEJvdW5kVGV4dCh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQXR0ckFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHsgcmV0dXJuIHZpc2l0b3IudmlzaXRBdHRyKHRoaXMsIGNvbnRleHQpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHR5cGU6IFByb3BlcnR5QmluZGluZ1R5cGUsIHB1YmxpYyB2YWx1ZTogQVNULFxuICAgICAgICAgICAgICBwdWJsaWMgdW5pdDogc3RyaW5nLCBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFbGVtZW50UHJvcGVydHkodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvdW5kRXZlbnRBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuYW1lOiBzdHJpbmcsIHB1YmxpYyB0YXJnZXQ6IHN0cmluZywgcHVibGljIGhhbmRsZXI6IEFTVCxcbiAgICAgICAgICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RXZlbnQodGhpcywgY29udGV4dCk7XG4gIH1cbiAgZ2V0IGZ1bGxOYW1lKCkge1xuICAgIGlmIChpc1ByZXNlbnQodGhpcy50YXJnZXQpKSB7XG4gICAgICByZXR1cm4gYCR7dGhpcy50YXJnZXR9OiR7dGhpcy5uYW1lfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLm5hbWU7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWYXJpYWJsZUFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IocHVibGljIG5hbWU6IHN0cmluZywgcHVibGljIHZhbHVlOiBzdHJpbmcsIHB1YmxpYyBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pIHt9XG4gIHZpc2l0KHZpc2l0b3I6IFRlbXBsYXRlQXN0VmlzaXRvciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdmlzaXRvci52aXNpdFZhcmlhYmxlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbGVtZW50QXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmFtZTogc3RyaW5nLCBwdWJsaWMgYXR0cnM6IEF0dHJBc3RbXSxcbiAgICAgICAgICAgICAgcHVibGljIGlucHV0czogQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSwgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRBc3RbXSxcbiAgICAgICAgICAgICAgcHVibGljIGV4cG9ydEFzVmFyczogVmFyaWFibGVBc3RbXSwgcHVibGljIGRpcmVjdGl2ZXM6IERpcmVjdGl2ZUFzdFtdLFxuICAgICAgICAgICAgICBwdWJsaWMgY2hpbGRyZW46IFRlbXBsYXRlQXN0W10sIHB1YmxpYyBuZ0NvbnRlbnRJbmRleDogbnVtYmVyLFxuICAgICAgICAgICAgICBwdWJsaWMgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKSB7fVxuICB2aXNpdCh2aXNpdG9yOiBUZW1wbGF0ZUFzdFZpc2l0b3IsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHZpc2l0b3IudmlzaXRFbGVtZW50KHRoaXMsIGNvbnRleHQpO1xuICB9XG5cbiAgaXNCb3VuZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKHRoaXMuaW5wdXRzLmxlbmd0aCA+IDAgfHwgdGhpcy5vdXRwdXRzLmxlbmd0aCA+IDAgfHwgdGhpcy5leHBvcnRBc1ZhcnMubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgdGhpcy5kaXJlY3RpdmVzLmxlbmd0aCA+IDApO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50KCk6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSB7XG4gICAgcmV0dXJuIHRoaXMuZGlyZWN0aXZlcy5sZW5ndGggPiAwICYmIHRoaXMuZGlyZWN0aXZlc1swXS5kaXJlY3RpdmUuaXNDb21wb25lbnQgP1xuICAgICAgICAgICAgICAgdGhpcy5kaXJlY3RpdmVzWzBdLmRpcmVjdGl2ZSA6XG4gICAgICAgICAgICAgICBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbWJlZGRlZFRlbXBsYXRlQXN0IGltcGxlbWVudHMgVGVtcGxhdGVBc3Qge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgYXR0cnM6IEF0dHJBc3RbXSwgcHVibGljIG91dHB1dHM6IEJvdW5kRXZlbnRBc3RbXSwgcHVibGljIHZhcnM6IFZhcmlhYmxlQXN0W10sXG4gICAgICAgICAgICAgIHB1YmxpYyBkaXJlY3RpdmVzOiBEaXJlY3RpdmVBc3RbXSwgcHVibGljIGNoaWxkcmVuOiBUZW1wbGF0ZUFzdFtdLFxuICAgICAgICAgICAgICBwdWJsaWMgbmdDb250ZW50SW5kZXg6IG51bWJlciwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RW1iZWRkZWRUZW1wbGF0ZSh0aGlzLCBjb250ZXh0KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IocHVibGljIGRpcmVjdGl2ZU5hbWU6IHN0cmluZywgcHVibGljIHRlbXBsYXRlTmFtZTogc3RyaW5nLCBwdWJsaWMgdmFsdWU6IEFTVCxcbiAgICAgICAgICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGlyZWN0aXZlUHJvcGVydHkodGhpcywgY29udGV4dCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIERpcmVjdGl2ZUFzdCBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0IHtcbiAgY29uc3RydWN0b3IocHVibGljIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLFxuICAgICAgICAgICAgICBwdWJsaWMgaW5wdXRzOiBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0W10sXG4gICAgICAgICAgICAgIHB1YmxpYyBob3N0UHJvcGVydGllczogQm91bmRFbGVtZW50UHJvcGVydHlBc3RbXSwgcHVibGljIGhvc3RFdmVudHM6IEJvdW5kRXZlbnRBc3RbXSxcbiAgICAgICAgICAgICAgcHVibGljIGV4cG9ydEFzVmFyczogVmFyaWFibGVBc3RbXSwgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0RGlyZWN0aXZlKHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBOZ0NvbnRlbnRBc3QgaW1wbGVtZW50cyBUZW1wbGF0ZUFzdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBpbmRleDogbnVtYmVyLCBwdWJsaWMgbmdDb250ZW50SW5kZXg6IG51bWJlcixcbiAgICAgICAgICAgICAgcHVibGljIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbikge31cbiAgdmlzaXQodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiB2aXNpdG9yLnZpc2l0TmdDb250ZW50KHRoaXMsIGNvbnRleHQpO1xuICB9XG59XG5cbmV4cG9ydCBlbnVtIFByb3BlcnR5QmluZGluZ1R5cGUge1xuICBQcm9wZXJ0eSxcbiAgQXR0cmlidXRlLFxuICBDbGFzcyxcbiAgU3R5bGVcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZUFzdFZpc2l0b3Ige1xuICB2aXNpdE5nQ29udGVudChhc3Q6IE5nQ29udGVudEFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEVtYmVkZGVkVGVtcGxhdGUoYXN0OiBFbWJlZGRlZFRlbXBsYXRlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RWxlbWVudChhc3Q6IEVsZW1lbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRWYXJpYWJsZShhc3Q6IFZhcmlhYmxlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RXZlbnQoYXN0OiBCb3VuZEV2ZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RWxlbWVudFByb3BlcnR5KGFzdDogQm91bmRFbGVtZW50UHJvcGVydHlBc3QsIGNvbnRleHQ6IGFueSk6IGFueTtcbiAgdmlzaXRBdHRyKGFzdDogQXR0ckFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdEJvdW5kVGV4dChhc3Q6IEJvdW5kVGV4dEFzdCwgY29udGV4dDogYW55KTogYW55O1xuICB2aXNpdFRleHQoYXN0OiBUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RGlyZWN0aXZlKGFzdDogRGlyZWN0aXZlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG4gIHZpc2l0RGlyZWN0aXZlUHJvcGVydHkoYXN0OiBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlVmlzaXRBbGwodmlzaXRvcjogVGVtcGxhdGVBc3RWaXNpdG9yLCBhc3RzOiBUZW1wbGF0ZUFzdFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dDogYW55ID0gbnVsbCk6IGFueVtdIHtcbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBhc3RzLmZvckVhY2goYXN0ID0+IHtcbiAgICB2YXIgYXN0UmVzdWx0ID0gYXN0LnZpc2l0KHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIGlmIChpc1ByZXNlbnQoYXN0UmVzdWx0KSkge1xuICAgICAgcmVzdWx0LnB1c2goYXN0UmVzdWx0KTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmVzdWx0O1xufVxuIl19