/**
 * @module
 * @description
 * This module is used for handling user input, by defining and building a {@link ControlGroup} that
 * consists of
 * {@link Control} objects, and mapping them onto the DOM. {@link Control} objects can then be used
 * to read information
 * from the form DOM elements.
 *
 * This module is not included in the `angular2` module; you must import the forms module
 * explicitly.
 *
 */
export { AbstractControl, Control, ControlGroup, ControlArray } from './forms/model';
export { AbstractControlDirective } from './forms/directives/abstract_control_directive';
export { ControlContainer } from './forms/directives/control_container';
export { NgControlName } from './forms/directives/ng_control_name';
export { NgFormControl } from './forms/directives/ng_form_control';
export { NgModel } from './forms/directives/ng_model';
export { NgControl } from './forms/directives/ng_control';
export { NgControlGroup } from './forms/directives/ng_control_group';
export { NgFormModel } from './forms/directives/ng_form_model';
export { NgForm } from './forms/directives/ng_form';
export { NG_VALUE_ACCESSOR } from './forms/directives/control_value_accessor';
export { DefaultValueAccessor } from './forms/directives/default_value_accessor';
export { NgControlStatus } from './forms/directives/ng_control_status';
export { CheckboxControlValueAccessor } from './forms/directives/checkbox_value_accessor';
export { NgSelectOption, SelectControlValueAccessor } from './forms/directives/select_control_value_accessor';
export { FORM_DIRECTIVES } from './forms/directives';
export { NG_VALIDATORS, NG_ASYNC_VALIDATORS, Validators } from './forms/validators';
export { RequiredValidator, MinLengthValidator, MaxLengthValidator } from './forms/directives/validators';
export { FormBuilder, FORM_PROVIDERS, FORM_BINDINGS } from './forms/form_builder';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9ybXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhbmd1bGFyMi9zcmMvY29tbW9uL2Zvcm1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7R0FZRztBQUNILFNBQVEsZUFBZSxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsWUFBWSxRQUFPLGVBQWUsQ0FBQztBQUVuRixTQUFRLHdCQUF3QixRQUFPLCtDQUErQyxDQUFDO0FBRXZGLFNBQVEsZ0JBQWdCLFFBQU8sc0NBQXNDLENBQUM7QUFDdEUsU0FBUSxhQUFhLFFBQU8sb0NBQW9DLENBQUM7QUFDakUsU0FBUSxhQUFhLFFBQU8sb0NBQW9DLENBQUM7QUFDakUsU0FBUSxPQUFPLFFBQU8sNkJBQTZCLENBQUM7QUFDcEQsU0FBUSxTQUFTLFFBQU8sK0JBQStCLENBQUM7QUFDeEQsU0FBUSxjQUFjLFFBQU8scUNBQXFDLENBQUM7QUFDbkUsU0FBUSxXQUFXLFFBQU8sa0NBQWtDLENBQUM7QUFDN0QsU0FBUSxNQUFNLFFBQU8sNEJBQTRCLENBQUM7QUFDbEQsU0FBOEIsaUJBQWlCLFFBQU8sMkNBQTJDLENBQUM7QUFDbEcsU0FBUSxvQkFBb0IsUUFBTywyQ0FBMkMsQ0FBQztBQUMvRSxTQUFRLGVBQWUsUUFBTyxzQ0FBc0MsQ0FBQztBQUNyRSxTQUFRLDRCQUE0QixRQUFPLDRDQUE0QyxDQUFDO0FBQ3hGLFNBQ0UsY0FBYyxFQUNkLDBCQUEwQixRQUNyQixrREFBa0QsQ0FBQztBQUMxRCxTQUFRLGVBQWUsUUFBTyxvQkFBb0IsQ0FBQztBQUNuRCxTQUFRLGFBQWEsRUFBRSxtQkFBbUIsRUFBRSxVQUFVLFFBQU8sb0JBQW9CLENBQUM7QUFDbEYsU0FDRSxpQkFBaUIsRUFDakIsa0JBQWtCLEVBQ2xCLGtCQUFrQixRQUViLCtCQUErQixDQUFDO0FBQ3ZDLFNBQVEsV0FBVyxFQUFFLGNBQWMsRUFBRSxhQUFhLFFBQU8sc0JBQXNCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBtb2R1bGVcbiAqIEBkZXNjcmlwdGlvblxuICogVGhpcyBtb2R1bGUgaXMgdXNlZCBmb3IgaGFuZGxpbmcgdXNlciBpbnB1dCwgYnkgZGVmaW5pbmcgYW5kIGJ1aWxkaW5nIGEge0BsaW5rIENvbnRyb2xHcm91cH0gdGhhdFxuICogY29uc2lzdHMgb2ZcbiAqIHtAbGluayBDb250cm9sfSBvYmplY3RzLCBhbmQgbWFwcGluZyB0aGVtIG9udG8gdGhlIERPTS4ge0BsaW5rIENvbnRyb2x9IG9iamVjdHMgY2FuIHRoZW4gYmUgdXNlZFxuICogdG8gcmVhZCBpbmZvcm1hdGlvblxuICogZnJvbSB0aGUgZm9ybSBET00gZWxlbWVudHMuXG4gKlxuICogVGhpcyBtb2R1bGUgaXMgbm90IGluY2x1ZGVkIGluIHRoZSBgYW5ndWxhcjJgIG1vZHVsZTsgeW91IG11c3QgaW1wb3J0IHRoZSBmb3JtcyBtb2R1bGVcbiAqIGV4cGxpY2l0bHkuXG4gKlxuICovXG5leHBvcnQge0Fic3RyYWN0Q29udHJvbCwgQ29udHJvbCwgQ29udHJvbEdyb3VwLCBDb250cm9sQXJyYXl9IGZyb20gJy4vZm9ybXMvbW9kZWwnO1xuXG5leHBvcnQge0Fic3RyYWN0Q29udHJvbERpcmVjdGl2ZX0gZnJvbSAnLi9mb3Jtcy9kaXJlY3RpdmVzL2Fic3RyYWN0X2NvbnRyb2xfZGlyZWN0aXZlJztcbmV4cG9ydCB7Rm9ybX0gZnJvbSAnLi9mb3Jtcy9kaXJlY3RpdmVzL2Zvcm1faW50ZXJmYWNlJztcbmV4cG9ydCB7Q29udHJvbENvbnRhaW5lcn0gZnJvbSAnLi9mb3Jtcy9kaXJlY3RpdmVzL2NvbnRyb2xfY29udGFpbmVyJztcbmV4cG9ydCB7TmdDb250cm9sTmFtZX0gZnJvbSAnLi9mb3Jtcy9kaXJlY3RpdmVzL25nX2NvbnRyb2xfbmFtZSc7XG5leHBvcnQge05nRm9ybUNvbnRyb2x9IGZyb20gJy4vZm9ybXMvZGlyZWN0aXZlcy9uZ19mb3JtX2NvbnRyb2wnO1xuZXhwb3J0IHtOZ01vZGVsfSBmcm9tICcuL2Zvcm1zL2RpcmVjdGl2ZXMvbmdfbW9kZWwnO1xuZXhwb3J0IHtOZ0NvbnRyb2x9IGZyb20gJy4vZm9ybXMvZGlyZWN0aXZlcy9uZ19jb250cm9sJztcbmV4cG9ydCB7TmdDb250cm9sR3JvdXB9IGZyb20gJy4vZm9ybXMvZGlyZWN0aXZlcy9uZ19jb250cm9sX2dyb3VwJztcbmV4cG9ydCB7TmdGb3JtTW9kZWx9IGZyb20gJy4vZm9ybXMvZGlyZWN0aXZlcy9uZ19mb3JtX21vZGVsJztcbmV4cG9ydCB7TmdGb3JtfSBmcm9tICcuL2Zvcm1zL2RpcmVjdGl2ZXMvbmdfZm9ybSc7XG5leHBvcnQge0NvbnRyb2xWYWx1ZUFjY2Vzc29yLCBOR19WQUxVRV9BQ0NFU1NPUn0gZnJvbSAnLi9mb3Jtcy9kaXJlY3RpdmVzL2NvbnRyb2xfdmFsdWVfYWNjZXNzb3InO1xuZXhwb3J0IHtEZWZhdWx0VmFsdWVBY2Nlc3Nvcn0gZnJvbSAnLi9mb3Jtcy9kaXJlY3RpdmVzL2RlZmF1bHRfdmFsdWVfYWNjZXNzb3InO1xuZXhwb3J0IHtOZ0NvbnRyb2xTdGF0dXN9IGZyb20gJy4vZm9ybXMvZGlyZWN0aXZlcy9uZ19jb250cm9sX3N0YXR1cyc7XG5leHBvcnQge0NoZWNrYm94Q29udHJvbFZhbHVlQWNjZXNzb3J9IGZyb20gJy4vZm9ybXMvZGlyZWN0aXZlcy9jaGVja2JveF92YWx1ZV9hY2Nlc3Nvcic7XG5leHBvcnQge1xuICBOZ1NlbGVjdE9wdGlvbixcbiAgU2VsZWN0Q29udHJvbFZhbHVlQWNjZXNzb3Jcbn0gZnJvbSAnLi9mb3Jtcy9kaXJlY3RpdmVzL3NlbGVjdF9jb250cm9sX3ZhbHVlX2FjY2Vzc29yJztcbmV4cG9ydCB7Rk9STV9ESVJFQ1RJVkVTfSBmcm9tICcuL2Zvcm1zL2RpcmVjdGl2ZXMnO1xuZXhwb3J0IHtOR19WQUxJREFUT1JTLCBOR19BU1lOQ19WQUxJREFUT1JTLCBWYWxpZGF0b3JzfSBmcm9tICcuL2Zvcm1zL3ZhbGlkYXRvcnMnO1xuZXhwb3J0IHtcbiAgUmVxdWlyZWRWYWxpZGF0b3IsXG4gIE1pbkxlbmd0aFZhbGlkYXRvcixcbiAgTWF4TGVuZ3RoVmFsaWRhdG9yLFxuICBWYWxpZGF0b3Jcbn0gZnJvbSAnLi9mb3Jtcy9kaXJlY3RpdmVzL3ZhbGlkYXRvcnMnO1xuZXhwb3J0IHtGb3JtQnVpbGRlciwgRk9STV9QUk9WSURFUlMsIEZPUk1fQklORElOR1N9IGZyb20gJy4vZm9ybXMvZm9ybV9idWlsZGVyJzsiXX0=