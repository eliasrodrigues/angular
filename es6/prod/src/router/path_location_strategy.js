var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { DOM } from 'angular2/src/platform/dom/dom_adapter';
import { Injectable, Inject } from 'angular2/angular2';
import { isBlank } from 'angular2/src/facade/lang';
import { BaseException } from 'angular2/src/facade/exceptions';
import { LocationStrategy, APP_BASE_HREF, normalizeQueryParams } from './location_strategy';
/**
 * `PathLocationStrategy` is a {@link LocationStrategy} used to configure the
 * {@link Location} service to represent its state in the
 * [path](https://en.wikipedia.org/wiki/Uniform_Resource_Locator#Syntax) of the
 * browser's URL.
 *
 * `PathLocationStrategy` is the default binding for {@link LocationStrategy}
 * provided in {@link ROUTER_PROVIDERS}.
 *
 * If you're using `PathLocationStrategy`, you must provide a provider for
 * {@link APP_BASE_HREF} to a string representing the URL prefix that should
 * be preserved when generating and recognizing URLs.
 *
 * For instance, if you provide an `APP_BASE_HREF` of `'/my/app'` and call
 * `location.go('/foo')`, the browser's URL will become
 * `example.com/my/app/foo`.
 *
 * ### Example
 *
 * ```
 * import {Component, provide} from 'angular2/angular2';
 * import {
 *   APP_BASE_HREF
 *   ROUTER_DIRECTIVES,
 *   ROUTER_PROVIDERS,
 *   RouteConfig,
 *   Location
 * } from 'angular2/router';
 *
 * @Component({directives: [ROUTER_DIRECTIVES]})
 * @RouteConfig([
 *  {...},
 * ])
 * class AppCmp {
 *   constructor(location: Location) {
 *     location.go('/foo');
 *   }
 * }
 *
 * bootstrap(AppCmp, [
 *   ROUTER_PROVIDERS, // includes binding to PathLocationStrategy
 *   provide(APP_BASE_HREF, {useValue: '/my/app'})
 * ]);
 * ```
 */
export let PathLocationStrategy = class extends LocationStrategy {
    constructor(href) {
        super();
        if (isBlank(href)) {
            href = DOM.getBaseHref();
        }
        if (isBlank(href)) {
            throw new BaseException(`No base href set. Please provide a value for the APP_BASE_HREF token or add a base element to the document.`);
        }
        this._location = DOM.getLocation();
        this._history = DOM.getHistory();
        this._baseHref = href;
    }
    onPopState(fn) {
        DOM.getGlobalEventTarget('window').addEventListener('popstate', fn, false);
        DOM.getGlobalEventTarget('window').addEventListener('hashchange', fn, false);
    }
    getBaseHref() { return this._baseHref; }
    prepareExternalUrl(internal) {
        if (internal.startsWith('/') && this._baseHref.endsWith('/')) {
            return this._baseHref + internal.substring(1);
        }
        return this._baseHref + internal;
    }
    path() { return this._location.pathname + normalizeQueryParams(this._location.search); }
    pushState(state, title, url, queryParams) {
        var externalUrl = this.prepareExternalUrl(url + normalizeQueryParams(queryParams));
        this._history.pushState(state, title, externalUrl);
    }
    forward() { this._history.forward(); }
    back() { this._history.back(); }
};
PathLocationStrategy = __decorate([
    Injectable(),
    __param(0, Inject(APP_BASE_HREF)), 
    __metadata('design:paramtypes', [String])
], PathLocationStrategy);
