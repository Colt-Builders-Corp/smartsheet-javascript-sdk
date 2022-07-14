import require$$0 from 'underscore';
import require$$1 from 'winston';
import require$$0$1 from 'bluebird';
import require$$5 from 'fs';

var smartsheetJavascriptSdk = {};

var apis = {
  contacts         :  'contacts/',
  events           :  'events/',
  favorites        :  'favorites/',
  folders          :  'folders/',
  groups           :  'groups/',
  home             :  'home/',
  imageUrls        :  'imageurls/',
  reports          :  'reports/',
  search           :  'search/',
  server           :  'serverinfo/',
  sheets           :  'sheets/',
  sights           :  'sights/',
  templates        :  'templates/',
  templatesPublic  :  'templates/public',
  token            :  'token',
  users            :  'users/',
  webhooks         :  'webhooks/',
  workspaces       :  'workspaces/'
};

var httpRequestor = {};

var constants = {};

var hasRequiredConstants;

function requireConstants () {
	if (hasRequiredConstants) return constants;
	hasRequiredConstants = 1;
	constants.maxRetryDurationMillis = 15000;

	constants.accessLevel = {
	  admin :       'ADMIN',
	  editor :      'EDITOR',
	  editorShare : 'EDITOR_SHARE',
	  owner :       'OWNER',
	  viewer :      'VIEWER'
	};

	constants.accessScope = {
	  adminSheets :     'ADMIN_SHEETS',
	  adminUsers :      'ADMIN_USERS',
	  adminWorkspaces : 'ADMIN_WORKSPACES',
	  createSheets :    'CREATE_SHEETS',
	  deleteSheets :    'DELETE_SHEETS',
	  readSheets :      'READ_SHEETS',
	  shareSheets :     'SHARE_SHEETS',
	  writeSheets :     'WRITE_SHEETS'
	};

	constants.types = {
	  sheet     : 'sheet',
	  folder    : 'folder',
	  report    : 'report',
	  template  : 'template',
	  workspace : 'workspace',
	  sight     : 'sight'
	};

	constants.paperSize = {
	  letter :   'LETTER',
	  legal :    'LEGAL',
	  wide :     'WIDE',
	  archd :    'ARCHD',
	  a4 :       'A4',
	  a3 :       'A4',
	  a2 :       'A2',
	  a1 :       'A1',
	  a0 :       'A0'
	};

	constants.acceptHeaders = {
	  applicationPdf :  'application/pdf',
	  applicationJson : 'application/json',
	  textCsv :         'text/csv',
	  vndMsExcel :      'application/vnd.ms-excel',
	  vndOpenXml :      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	};

	constants.sheet = {
	  name: 'New Sheet via API',
	  columns: [
	    {
	      title: 'Primary Column',
	      type: 'TEXT_NUMBER',
	      primary: true,
	      width: 150
	    },
	    {
	      title: 'Column2',
	      type: 'TEXT_NUMBER',
	      width: 150
	    },
	    {
	      title: 'Column3',
	      type: 'TEXT_NUMBER',
	      width: 150
	    },
	    {
	      title: 'Column4',
	      type: 'TEXT_NUMBER',
	      width: 150
	    },
	    {
	      title: 'Column5',
	      type: 'TEXT_NUMBER',
	      width: 150
	    },
	    {
	      title: 'Column6',
	      type: 'TEXT_NUMBER',
	      width: 150
	    }
	  ]
	};
	return constants;
}

var requestLogger = {};

var hasRequiredRequestLogger;

function requireRequestLogger () {
	if (hasRequiredRequestLogger) return requestLogger;
	hasRequiredRequestLogger = 1;
	var _ = require$$0;

	requestLogger.create = function(logger) {
	  const PAYLOAD_PREVIEW_LENGTH = 1024;
	  const EXPOSED_CENSOR_CHARS = 4;

	  var logRequest = (verb, requestOptions) => {
	    logRequestBasics('info', verb, requestOptions);
	    logHeaders('Request', requestOptions.headers);
	    logPreviewAndFullPayload('Request', requestOptions.body);
	  };

	  var logRetryAttempt = (verb, requestOptions, error, attemptNum) => {
	    logger.warn('Request failed, performing retry #%d\nCause: ', attemptNum, error);
	    logRequestBasics('warn', verb, requestOptions);
	  };
	  
	  var logRetryFailure = (verb, requestOptions, attemptNum) => {
	    logger.error('Request failed after %d retries', attemptNum);
	  };
	  
	  var logSuccessfulResponse = response => {
	    logger.info('Response: Success (HTTP %d)', response.statusCode);
	    logHeaders('Response', response.headers);
	    logResponsePayload('Response', response.content);
	  };

	  var logErrorResponse = (verb, requestOptions, error) => {
	    logRequestBasics('error', verb, requestOptions);
	    logger.error(
	      'Response: Failure (HTTP %d)\n\tError Code: %d - %s\n\tRef ID: %s',
	      error.statusCode, error.errorCode, error.message, error.refId);
	    logHeaders('Response', error.headers);
	  };

	  var log = logger.log;

	  var logRequestBasics = (level, verb, requestOptions) => {
	    var url = buildLoggingUrl(requestOptions);

	    logger.log(level, '%s %s', verb, url);
	  };

	  var logHeaders = (context, headers) => {
	    if(_.isEmpty(headers)) return;

	    logger.silly('%s Headers: %s', context, JSON.stringify(censorHeaders(headers)));
	  };

	  var logResponsePayload = (context, payload) => {
	    if(_.isEmpty(payload)) return;

	    var censoredPayload = censorPayload(payload);
	    var payloadStr = JSON.stringify(censoredPayload);
	    logPreviewAndFullPayload(context, payloadStr);
	  };

	  var logPreviewAndFullPayload = (context, payloadStr) => {
	    if(_.isEmpty(payloadStr)) return;

	    var preview = payloadStr;
	    if(typeof preview === 'string' && preview.length > PAYLOAD_PREVIEW_LENGTH) {
	      preview = preview.substring(0, PAYLOAD_PREVIEW_LENGTH) + '...';
	    }

	    logger.verbose('%s Payload (preview): %s', context, preview);
	    logger.debug('%s Payload (full): %s', context, payloadStr);
	  };

	  // Formatting Utilities

	  var buildLoggingUrl = requestOptions => {
	    var queryParams = '';
	    var qs = requestOptions.qs;
	    if(!_.isEmpty(qs)) {
	      qs = censorQueryParams(qs);

	      queryParams =
	        '?' +
	        (_.pairs(qs)
	          .map((pair) => `${encodeURIComponent(pair[0])}=${encodeURIComponent(pair[1])}`)
	          .join('&'));
	    }
	    return requestOptions.url + queryParams;
	  };
	  
	  var censor = s => {
	    if(_.isEmpty(s)) return s;

	    var censoredSection = '*'.repeat(Math.max(s.length - EXPOSED_CENSOR_CHARS, 0));
	    var exposedSection = s.slice(-EXPOSED_CENSOR_CHARS);
	    return censoredSection + exposedSection;
	  };
	  
	  var buildCensor = function(blacklist) {
	    return obj => _.mapObject(obj, (val, key) => {
	      var keyMatch = key.toLowerCase();
	      return (blacklist.indexOf(keyMatch) != -1) // Found in censor blacklist
	        ? censor(val)
	        : val;
	    });
	  };

	  const queryParamBlacklist = ['code', 'client_id', 'hash', 'refresh_token'].sort();
	  var censorQueryParams = buildCensor(queryParamBlacklist);

	  var headerBlacklist = ['authorization'].sort();
	  var censorHeaders = buildCensor(headerBlacklist);

	  var payloadBlacklist = ['access_token', 'refresh_token'].sort();
	  var censorPayload = buildCensor(payloadBlacklist);

	  // Logger final configuration

	  var formatLog = (level, msg, meta) => {
	    var timestamp = new Date().toISOString();
	    var displayLevel = padStart(level.toUpperCase(), 7);
	    
	    return `${timestamp}[${displayLevel}] ${msg}`;
	  };

	  var padStart = (str, maxLength) => {
	      if (str.length >= maxLength) return str;
	  
	      var timesToRepeat = maxLength - str.length;
	      return ' '.repeat(timesToRepeat) + str;
	  };

	  if(logger.filters) {
	    logger.filters.push(formatLog);
	  }

	  // Generated object

	  return {
	    logRequest: logRequest,
	    logRetryAttempt: logRetryAttempt,
	    logRetryFailure: logRetryFailure,
	    logSuccessfulResponse: logSuccessfulResponse,
	    logErrorResponse: logErrorResponse,
	    log: log
	  };
	};

	const doNothing = () => {};
	requestLogger.empty = {
	  logRequest: doNothing,
	  logRetryAttempt: doNothing,
	  logRetryFailure: doNothing,
	  logSuccessfulResponse: doNothing,
	  logErrorResponse: doNothing,
	  log: doNothing
	};
	return requestLogger;
}

var name = "smartsheet";
var version = "2.126.0";
var description = "Smartsheet JavaScript client SDK";
var main = "index.js";
var scripts = {
	test: "mocha \"test/**/*_test.js\"",
	"test-functional": "mocha \"test/functional/**/*_test.js\"",
	"test-mock-api": "mocha \"test/mock-api/**/*_test.js\"",
	coverage: "istanbul cover _mocha -- -u exports -R spec \"test/**/*_test.js\"",
	"report-coverage": "cat ./coverage/lcov.info | coveralls"
};
var repository = {
	type: "git",
	url: "github:smartsheet-platform/smartsheet-javascript-sdk"
};
var keywords = [
	"Smartsheet",
	"productivity",
	"collaboration"
];
var author = "Smartsheet";
var license = "Apache-2.0";
var bugs = {
	url: "https://github.com/smartsheet-platform/smartsheet-javascript-sdk/issues",
	email: "api@smartsheet.com"
};
var browser = {
	request: "browser-request"
};
var homepage = "http://developers.smartsheet.com";
var dependencies = {
	bluebird: "^3.5.0",
	extend: "^3.0.2",
	request: "^2.88.0",
	rollup: "^2.76.0",
	underscore: "^1.8.2",
	winston: "^2.3.1"
};
var devDependencies = {
	"@rollup/plugin-commonjs": "^22.0.1",
	"@rollup/plugin-json": "^4.1.0",
	coveralls: "^3.0.2",
	gulp: "^4.0.0",
	"gulp-jshint": "^2.1.0",
	"gulp-mocha": "^6.0.0",
	istanbul: "^0.4.5",
	"jshint-stylish": "^1.0.1",
	mocha: "^5.2.0",
	mock: "^0.1.1",
	should: "^13.0.1",
	sinon: "^1.14.1",
	yargs: "^14.0.0"
};
var directories = {
	lib: "lib",
	test: "test"
};
var require$$4 = {
	name: name,
	version: version,
	description: description,
	main: main,
	scripts: scripts,
	repository: repository,
	keywords: keywords,
	author: author,
	license: license,
	bugs: bugs,
	browser: browser,
	homepage: homepage,
	dependencies: dependencies,
	devDependencies: devDependencies,
	directories: directories
};

var request = {};

var hasRequiredRequest;

function requireRequest () {
	if (hasRequiredRequest) return request;
	hasRequiredRequest = 1;
	var _ = require$$0;

	request.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);

	  var get = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  var post = (postOptions, callback) =>
	    requestor.post(_.extend({}, optionsToSend, postOptions), callback);

	  var put = (putOptions, callback) =>
	    requestor.put(_.extend({}, optionsToSend, putOptions), callback);

	  var postFile = (postOptions, callback) =>
	    requestor.postFile(_.extend({}, optionsToSend, postOptions), callback);

	  var deleteRequest = (deleteOptions, callback) =>
	    requestor.delete(_.extend({}, optionsToSend, deleteOptions), callback);

	  return {
	    get : get,
	    post  : post,
	    put : put,
	    postFile : postFile,
	    delete : deleteRequest
	  };
	};
	return request;
}

var responseHandler;
var hasRequiredResponseHandler;

function requireResponseHandler () {
	if (hasRequiredResponseHandler) return responseHandler;
	hasRequiredResponseHandler = 1;
	var Promise = require$$0$1;

	responseHandler = (response, body) => {
	  var outResponse = {
	    statusCode: response.statusCode,
	    headers: response.headers,
	    body: body
	  };

	  if (response.statusCode != 200) {
	    var errorResponse = outResponse;
	    if (/\bapplication\/json\b/.test(response.headers['content-type'])) {
	      var responseBody = JSON.parse(body);
	      errorResponse.errorCode = responseBody.errorCode;
	      errorResponse.message = responseBody.message;
	      errorResponse.refId = responseBody.refId;
	      
	      if (responseBody.detail !== undefined) {
	        errorResponse.detail = responseBody.detail;
	      }
	    } else {
	      errorResponse.message = body;
	    }

	    return new Promise.reject(errorResponse);
	  } else if (response.headers['content-type'] === 'application/json;charset=UTF-8') {
	    outResponse.content = JSON.parse(body);
	    return outResponse;
	  } else {
	    outResponse.content = body;
	    return outResponse;
	  }
	};
	return responseHandler;
}

var hasRequiredHttpRequestor;

function requireHttpRequestor () {
	if (hasRequiredHttpRequestor) return httpRequestor;
	hasRequiredHttpRequestor = 1;
	var Promise = require$$0$1;
	var _ = require$$0;
	var constants = requireConstants();
	var requestLogger = requireRequestLogger();
	var packageJson = require$$4;
	var fs = require$$5;

	httpRequestor.create = function(requestorConfig) {
	  var logger = requestorConfig.logger
	    ? requestLogger.create(requestorConfig.logger)
	    : requestLogger.empty;

	  var request = requestorConfig.request ||
	                Promise.promisifyAll(requireRequest(), {multiArgs: true});

	  var handleResponse = requestorConfig.handleResponse ||
	                       requireResponseHandler();

	  var defaultCalcBackoff = numRetries => (Math.pow(2, numRetries) + Math.random()) * 1000;
	  var defaultRetryOptions = {
	    maxRetryDurationMillis: requestorConfig.maxRetryDurationMillis ||
	                            constants.maxRetryDurationMillis,
	    calcRetryBackoff: requestorConfig.calcRetryBackoff || defaultCalcBackoff
	  };

	  var getFileSizeFromPath = (path) => {
	    var stats = fs.statSync(path);

	    return stats.size;
	  };

	  var buildHeaders = options => {
	    var headers = {
	      Accept: options.accept || 'application/json',
	      'Content-Type': options.contentType || 'application/json',
	      'User-Agent': `smartsheet-javascript-sdk/${packageJson.version}`
	    };

	    if (options.userAgent) {
	      headers['User-Agent'] += `/${options.userAgent}`;
	    }

	    if(options.accessToken) {
	      headers.Authorization = 'Bearer ' + options.accessToken;
	    }
	    if(options.assumeUser) {
	      headers['Assume-User'] = encodeURIComponent(options.assumeUser);
	    }
	    if (options.fileName) {
	      headers['Content-Disposition'] = `attachment; filename="${options.fileName}"`;
	    }
	    if (options.contentDisposition) {
	      headers['Content-Disposition'] = options.contentDisposition;
	    }

	    if (options.path) {
	      headers['Content-Length'] = getFileSizeFromPath(options.path);
	    }
	    else if (options.fileSize) {
	      headers['Content-Length'] = options.fileSize;
	    }
	    if(options.apiScenario) {
	      headers['Api-Scenario'] = options.apiScenario;
	    }
	    if(options.changeAgent) {
	      headers['Smartsheet-Change-Agent'] = options.changeAgent;
	    }
	    if(options.customProperties) {
	      for (const [key, value] of Object.entries(options.customProperties)) {
	        headers[key] = value;
	      }
	    }
	    return headers;
	  };

	  var buildUrl = options => {
	    var baseUrl = options.baseUrl || process.env.SMARTSHEET_API_HOST || 'https://api.smartsheet.com/2.0/';
	    if (options.id) {
	      return baseUrl + options.url + options.id;
	    } else {
	      return baseUrl + (options.url || '');
	    }
	  };

	  var get = (options, callback) =>
	    methodRequest(options, request.getAsync, 'GET', callback);

	  var post = (options, callback) => {
	    var requestExtension = { body: JSON.stringify(options.body) };

	    return methodRequest(options, request.postAsync, 'POST', callback, requestExtension);
	  };

	  var getFileBody = (options) => {
	    if (options.path) {
	      return fs.createReadStream(options.path);
	    }

	    return options.fileStream;
	  };

	  var postFile = (options, callback) => {
	    var requestExtension = { body: getFileBody(options) };

	    return methodRequest(options, request.postAsync, 'POST', callback, requestExtension);
	  };

	  var deleteFunc = (options, callback)  =>
	    methodRequest(options, request.delAsync, 'DELETE', callback);

	  var put = (options, callback) => {
	    var requestExtension = { body: JSON.stringify(options.body) };

	    return methodRequest(options, request.putAsync, 'PUT', callback, requestExtension);
	  };

	  var methodRequest = (options, method, methodName, callback, requestExtension) => {
	    var baseRequestOptions = {
	      url: buildUrl(options),
	      headers: buildHeaders(options),
	      qs: options.queryParameters,
	      encoding: options.encoding,
	      gzip: true
	    };
	    var requestOptions = _.extend(baseRequestOptions, requestExtension);

	    var retryOptions = _.pick(options, 'maxRetryDurationMillis', 'calcRetryBackoff');

	    logger.logRequest(methodName, requestOptions);

	    return makeRequestWithRetries(method, methodName, requestOptions, retryOptions, callback);
	  };

	  var makeRequestWithRetries = (method, methodName, requestOptions, retryOptions, callback) => {
	    var effectiveRetryOptions = _.defaults(retryOptions, defaultRetryOptions);

	    effectiveRetryOptions.endRetryTime = Date.now() + effectiveRetryOptions.maxRetryDurationMillis;

	    return retryHelper(method, methodName, requestOptions, effectiveRetryOptions, 0)
	      .tap(logger.logSuccessfulResponse)
	      .tapCatch(error => logger.logErrorResponse(methodName, requestOptions, error))
	      .get('content')
	      .catch(error => Promise.reject(_.omit(error, 'headers', 'body')))
	      .nodeify(callback);
	  };

	  var retryHelper = (method, methodName, requestOptions, retryOptions, numRetries) =>
	    makeRequest(method, methodName, requestOptions)
	      .catch(retryWithBackoffHelper(method, methodName, requestOptions, retryOptions, numRetries));

	  var makeRequest = (method, methodName, requestOptions) =>
	    method(requestOptions).spread(handleResponse);

	  var retryWithBackoffHelper = (method, methodName, requestOptions, retryOptions, numRetries) => {
	    return error => {
	      var backoffMillis = retryOptions.calcRetryBackoff(numRetries, error);

	      var shouldExitRetry =
	        !shouldRetry(error) ||
	        backoffMillis < 0 ||
	        Date.now() + backoffMillis >= retryOptions.endRetryTime;

	      if (shouldExitRetry) {
	        logger.logRetryFailure(methodName, requestOptions, numRetries);
	        return new Promise.reject(error);
	      }

	      var nextRetry = numRetries + 1;
	      logger.logRetryAttempt(methodName, requestOptions, error, nextRetry);
	      return Promise.delay(backoffMillis)
	        .then(() => retryHelper(method, methodName, requestOptions, retryOptions, nextRetry));
	    };
	  };

	  var shouldRetry = error =>
	    error.errorCode === 4001 ||
	    error.errorCode === 4002 ||
	    error.errorCode === 4003 ||
	    error.errorCode === 4004;

	  return {
	    get: get,
	    put: put,
	    post: post,
	    postFile: postFile,
	    delete: deleteFunc,
	    internal: {
	      buildHeaders: buildHeaders,
	      buildUrl: buildUrl
	    }
	  };
	};
	return httpRequestor;
}

var contacts = {};

var hasRequiredContacts;

function requireContacts () {
	if (hasRequiredContacts) return contacts;
	hasRequiredContacts = 1;
	var _ = require$$0;

	contacts.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	      url: options.apiUrls.contacts,
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var getContact = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  return {
	    getContact : getContact,
	    listContacts : getContact
	  };
	};
	return contacts;
}

var events = {};

var hasRequiredEvents;

function requireEvents () {
	if (hasRequiredEvents) return events;
	hasRequiredEvents = 1;
	var _ = require$$0;

	events.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.events
	  };
	  _.extend(optionsToSend, options.clientOptions);

	  var getEvents = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  return {
	    getEvents : getEvents
	  };
	};
	return events;
}

var favorites = {};

var hasRequiredFavorites;

function requireFavorites () {
	if (hasRequiredFavorites) return favorites;
	hasRequiredFavorites = 1;
	var _ = require$$0;
	var types = requireConstants().types;

	favorites.create = options => {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.favorites,
	  };
	  _.extend(optionsToSend, options.clientOptions);

	  var listFavorites = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  var addItemsToFavorites = (postOptions, callback) =>
	    requestor.post(_.extend({}, optionsToSend, postOptions), callback);

	  var handleFavorites = (postOptions, callback) => {
	    var body = _.pick(postOptions, 'type', 'objectId');
	    var options = _.omit(postOptions, 'type', 'objectId');

	    options.body = body;
	    return addItemsToFavorites(options, callback);
	  };

	  var buildFavoriteAddition = function(type) {
	    return (postOptions, callback) => {
	      var options = JSON.parse(JSON.stringify(postOptions));
	      options.type = type;
	      return handleFavorites(options, callback);
	    };
	  };

	  var addSheetToFavorites = buildFavoriteAddition(types.sheet);

	  var addFolderToFavorites = buildFavoriteAddition(types.folder);

	  var addReportToFavorites = buildFavoriteAddition(types.report);

	  var addTemplateToFavorites = buildFavoriteAddition(types.template);

	  var addWorkspaceToFavorites = buildFavoriteAddition(types.workspace);

	  var addSightToFavorites = buildFavoriteAddition(types.sight);

	  var addMultipleToFavorites = (postOptions, callback) => {
	    return requestor.post(_.extend({}, optionsToSend, postOptions), callback);
	  };

	  var removeFavorite = (deleteOptions, callback) => {
	    var params = deleteOptions.queryParameters;
	    if (params && _.isArray(params.objectIds)) {
	      params.objectIds = params.objectIds.join(',');
	    }

	    var urlOptions = {url: options.apiUrls.favorites + deleteOptions.type + '/' + (deleteOptions.id || deleteOptions.objectId || '')};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var buildFavoriteRemoval = function(type) {
	    return (deleteOptions, callback) => {
	      var options = JSON.parse(JSON.stringify(deleteOptions));
	      options.type = type;
	      return removeFavorite(options, callback);
	    };
	  };

	  var removeSheetFromFavorites = buildFavoriteRemoval(types.sheet);

	  var removeFolderFromFavorites = buildFavoriteRemoval(types.folder);

	  var removeReportFromFavorites = buildFavoriteRemoval(types.report);

	  var removeTemplateFromFavorites = buildFavoriteRemoval(types.template);

	  var removeWorkspaceFromFavorites = buildFavoriteRemoval(types.workspace);

	  var removeSightFromFavorites = buildFavoriteRemoval(types.sight);

	  return {
	    listFavorites : listFavorites,
	    addItemsToFavorites : addItemsToFavorites,
	    addSheetToFavorites : addSheetToFavorites,
	    addFolderToFavorites : addFolderToFavorites,
	    addReportToFavorites : addReportToFavorites,
	    addTemplateToFavorites : addTemplateToFavorites,
	    addSightToFavorites : addSightToFavorites,
	    addWorkspaceToFavorites : addWorkspaceToFavorites,
	    addMultipleToFavorites : addMultipleToFavorites,
	    removeSheetFromFavorites : removeSheetFromFavorites,
	    removeFolderFromFavorites : removeFolderFromFavorites,
	    removeReportFromFavorites : removeReportFromFavorites,
	    removeTemplateFromFavorites : removeTemplateFromFavorites,
	    removeSightFromFavorites : removeSightFromFavorites,
	    removeWorkspaceFromFavorites : removeWorkspaceFromFavorites,
	    //convenience methods to remove multiples.
	    //Uses the same as the singular remove methods.
	    removeSheetsFromFavorites : removeSheetFromFavorites,
	    removeFoldersFromFavorites : removeFolderFromFavorites,
	    removeReportsFromFavorites : removeReportFromFavorites,
	    removeTemplatesFromFavorites : removeTemplateFromFavorites,
	    removeSightsFromFavorites : removeSightFromFavorites,
	    removeWorkspacesFromFavorites : removeWorkspaceFromFavorites
	  };
	};
	return favorites;
}

var folders = {};

var hasRequiredFolders;

function requireFolders () {
	if (hasRequiredFolders) return folders;
	hasRequiredFolders = 1;
	var _ = require$$0;

	folders.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.folders,
	    urls : options.apiUrls,
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var getFolder = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  var listChildFolders = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.folders + getOptions.folderId + '/folders'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var createChildFolder = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.folders + postOptions.folderId + '/folders'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var updateFolder = (putOptions, callback) =>
	    requestor.put(_.extend({}, optionsToSend, putOptions), callback);

	  var deleteFolder = (deleteOptions, callback) =>
	    requestor.delete(_.extend({}, optionsToSend, deleteOptions), callback);

	  var copyFolder = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.folders + postOptions.folderId + '/copy'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var moveFolder = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.folders + postOptions.folderId + '/move'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  return {
	    getFolder  : getFolder,
	    listChildFolders : listChildFolders,
	    createChildFolder : createChildFolder,
	    updateFolder : updateFolder,
	    deleteFolder : deleteFolder,
	    moveFolder : moveFolder,
	    copyFolder : copyFolder
	  };
	};
	return folders;
}

var groups = {};

var hasRequiredGroups;

function requireGroups () {
	if (hasRequiredGroups) return groups;
	hasRequiredGroups = 1;
	var _ = require$$0;

	groups.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.groups,
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var listGroups = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  var createGroup = (postOptions, callback) =>
	    requestor.post(_.extend({}, optionsToSend, postOptions), callback);

	  var addGroupMembers = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.groups + postOptions.groupId + '/members/'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var updateGroup = (putOptions, callback) =>
	    requestor.put(_.extend({}, optionsToSend, putOptions), callback);

	  var deleteGroup = (deleteOptions, callback) =>
	    requestor.delete(_.extend({}, optionsToSend, deleteOptions), callback);

	  var removeGroupMember = (deleteOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.groups + deleteOptions.groupId + '/members/' + deleteOptions.userId};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  return {
	    listGroups        : listGroups,
	    getGroup          : listGroups,
	    createGroup       : createGroup,
	    addGroupMembers   : addGroupMembers,
	    updateGroup       : updateGroup,
	    deleteGroup       : deleteGroup,
	    removeGroupMember : removeGroupMember
	  };
	};
	return groups;
}

var home = {};

var hasRequiredHome;

function requireHome () {
	if (hasRequiredHome) return home;
	hasRequiredHome = 1;
	var _ = require$$0;

	home.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.home,
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var listContents = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  var listFolders = (getOptions, callback) =>
	    listContents(_.extend({url: options.apiUrls.home + 'folders'}, getOptions), callback);

	  var createFolder = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.home + 'folders'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  return {
	    listContents : listContents,
	    listFolders  : listFolders,
	    createFolder : createFolder
	  };
	};
	return home;
}

var images = {};

var hasRequiredImages;

function requireImages () {
	if (hasRequiredImages) return images;
	hasRequiredImages = 1;
	var _ = require$$0;

	images.create = function(options) {
	  var optionsToSend = {
	    url: options.apiUrls.imageUrls,
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var listImageUrls = (postOptions, callback) =>
	    options.requestor.post(_.extend({}, optionsToSend, postOptions), callback);

	  return {
	    listImageUrls : listImageUrls
	  };
	};
	return images;
}

var reports = {};

var share;
var hasRequiredShare;

function requireShare () {
	if (hasRequiredShare) return share;
	hasRequiredShare = 1;
	var _ = require$$0;

	share = url => ({
	  create: function(options) {
	    var requestor = options.requestor;

	    var optionsToSend = _.extend({}, options.clientOptions);


	    var listShares = (getOptions, callback) => {
	      var urlOptions = {url: buildUrl(getOptions)};
	      return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	    };

	    var share = (postOptions, callback) => {
	      var urlOptions = {url: buildUrl(postOptions)};
	      return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	    };

	    var deleteShare = (deleteOptions, callback) => {
	      var urlOptions = {url: buildUrl(deleteOptions)};
	      return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	    };

	    var updateShare = (putOptions, callback) => {
	      var urlOptions = {url: buildUrl(putOptions)};
	      return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	    };

	    var buildUrl = urlOptions =>
	      url + (urlOptions.sheetId || urlOptions.workspaceId || urlOptions.reportId || urlOptions.sightId) + '/shares/' + (urlOptions.shareId || '');

	    return {
	      getShare: listShares,
	      listShares: listShares,
	      share: share,
	      deleteShare: deleteShare,
	      updateShare: updateShare
	    };
	  }
	});
	return share;
}

var hasRequiredReports;

function requireReports () {
	if (hasRequiredReports) return reports;
	hasRequiredReports = 1;
	var _ = require$$0;
	var constants = requireConstants();

	reports.create = function(options) {
	  var shares = requireShare()(options.apiUrls.reports);
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.reports,
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var getReport = (getOptions, callback) => {
	    return requestor.get(_.extend({}, optionsToSend, getOptions), callback);
	  };

	  var sendReportViaEmail = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.reports + postOptions.reportId + '/emails'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var getReportAsExcel = (getOptions, callback) => {
	    var acceptOptions = {accept: constants.acceptHeaders.vndMsExcel, encoding:null};
	    return requestor.get(_.extend({}, optionsToSend, acceptOptions, getOptions), callback);
	  };

	  var getReportAsCSV = (getOptions, callback) => {
	    var acceptOptions = {accept: constants.acceptHeaders.textCsv};
	    return requestor.get(_.extend({}, optionsToSend, acceptOptions, getOptions), callback);
	  };

	  var getReportPublishStatus = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.reports + getOptions.reportId + '/publish'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var setReportPublishStatus = (putOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.reports + putOptions.reportId + '/publish'};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var reportObject = {
	    listReports : getReport,
	    getReport : getReport,
	    sendReportViaEmail : sendReportViaEmail,
	    getReportAsExcel : getReportAsExcel,
	    getReportAsCSV : getReportAsCSV,
	    getReportPublishStatus : getReportPublishStatus,
	    setReportPublishStatus : setReportPublishStatus
	  };

	  return _.extend(reportObject, shares.create(options));
	};
	return reports;
}

var search = {};

var hasRequiredSearch;

function requireSearch () {
	if (hasRequiredSearch) return search;
	hasRequiredSearch = 1;
	var _ = require$$0;

	search.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.search,
	    urls : options.apiUrls,
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var searchAll = (getOptions, callback) => {
	    var options = JSON.parse(JSON.stringify(getOptions));
	    options.queryParameters = options.queryParameters || {};
	    options.queryParameters = _.extend({query: options.query}, options.queryParameters);

	    return requestor.get(_.extend({}, optionsToSend, options), callback);
	  };

	  var searchSheet = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.search + 'sheets/' + getOptions.sheetId};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  return {
	    searchAll : searchAll,
	    searchSheet : searchSheet
	  };
	};
	return search;
}

var server = {};

var hasRequiredServer;

function requireServer () {
	if (hasRequiredServer) return server;
	hasRequiredServer = 1;
	var _ = require$$0;

	server.create = function(options) {
	  var optionsToSend = {
	    url: options.apiUrls.server,
	    urls : options.apiUrls,
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var getInfo = (getOptions, callback) =>
	    options.requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  return {
	    getInfo : getInfo
	  };
	};
	return server;
}

var sheets = {};

var attachments = {};

var hasRequiredAttachments;

function requireAttachments () {
	if (hasRequiredAttachments) return attachments;
	hasRequiredAttachments = 1;
	var _ = require$$0;

	attachments.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var listAttachments = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listAttachmentVersions = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions) + '/versions'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var addUrlAttachment = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var addFileAttachment = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions)};
	    return requestor.postFile(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var attachNewVersion = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/versions'};
	    return requestor.postFile(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var deleteAttachment = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var deleteAllAttachmentVersions = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions) + '/versions'};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var buildUrl = urlOptions =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/attachments/' + (urlOptions.attachmentId || '');

	  return {
	    getAttachment : listAttachments,
	    listAttachments : listAttachments,
	    listAttachmentVersions : listAttachmentVersions,
	    addAttachment: addUrlAttachment,
	    addUrlAttachment : addUrlAttachment,
	    addFileAttachment : addFileAttachment,
	    attachNewVersion : attachNewVersion,
	    deleteAttachment : deleteAttachment,
	    deleteAllAttachmentVersions : deleteAllAttachmentVersions
	  };
	};
	return attachments;
}

var automationrules = {};

var hasRequiredAutomationrules;

function requireAutomationrules () {
	if (hasRequiredAutomationrules) return automationrules;
	hasRequiredAutomationrules = 1;
	var _ = require$$0;

	automationrules.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);

	  var deleteAutomationRule = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var getAutomationRule = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listAutomationRules = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var updateAutomationRule = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var buildUrl = urlOptions =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/automationrules/' + (urlOptions.automationRuleId || '');

	  return {
	    deleteAutomationRule : deleteAutomationRule,
	    getAutomationRule : getAutomationRule,
	    listAutomationRules : listAutomationRules,
	    updateAutomationRule : updateAutomationRule
	  };
	};
	return automationrules;
}

var columns = {};

var hasRequiredColumns;

function requireColumns () {
	if (hasRequiredColumns) return columns;
	hasRequiredColumns = 1;
	var _ = require$$0;

	columns.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var getColumns = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var addColumn = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var updateColumn = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var deleteColumn = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var buildUrl = urlOptions =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/columns/' + (urlOptions.columnId || '');

	  return {
	    getColumns : getColumns,
	    getColumn : getColumns,
	    addColumn : addColumn,
	    deleteColumn : deleteColumn,
	    updateColumn : updateColumn
	  };
	};
	return columns;
}

var comments = {};

var hasRequiredComments;

function requireComments () {
	if (hasRequiredComments) return comments;
	hasRequiredComments = 1;
	var _ = require$$0;

	comments.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var getComment = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var deleteComment = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var addCommentUrlAttachment = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/attachments'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var addCommentFileAttachment = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/attachments'};
	    return requestor.postFile(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var editComment = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var buildUrl = urlOptions =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/comments/' + (urlOptions.commentId || '');

	  return {
	    getComment : getComment,
	    deleteComment : deleteComment,
	    addCommentUrlAttachment : addCommentUrlAttachment,
	    addCommentAttachment: addCommentUrlAttachment,
	    addCommentFileAttachment : addCommentFileAttachment,
	    editComment : editComment
	  };
	};
	return comments;
}

var create = {};

var hasRequiredCreate;

function requireCreate () {
	if (hasRequiredCreate) return create;
	hasRequiredCreate = 1;
	var _ = require$$0;
	var headers = requireConstants().acceptHeaders;

	create.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.sheets
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var createSheet = (postOptions, callback) =>
	    requestor.post(_.extend({}, optionsToSend, postOptions), callback);

	  var createSheetFromExisting = (postOptions, callback) => {
	    var options = JSON.parse(JSON.stringify(postOptions));
	    if (options.workspaceId) {
	        return createSheetInWorkspace(options, callback);
	    } else if (options.folderId) {
	        return createSheetInFolder(options, callback);
	    } else {
	        return createSheet(options, callback);
	    }
	  };

	  var createSheetInFolder = (postOptions, callback) => {
	    var urlOptions = {url: buildFolderUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var createSheetInWorkspace = (postOptions, callback) => {
	    var urlOptions = {url: buildWorkspaceUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var copySheet = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets + postOptions.sheetId + '/copy'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var importSheet = (postOptions, callback, contentType, baseUrl) => {
	    var urlOptions = {
	      url: baseUrl +  'import',
	      contentType: contentType,
	      contentDisposition: 'attachment'
	    };
	    return requestor.postFile(_.extend({}, optionsToSend, urlOptions, postOptions));
	  };

	  var importXlsxSheet = (postOptions, callback) => {
	    return importSheet(postOptions, callback, headers.vndOpenXml, options.apiUrls.sheets);
	  };

	  var importCsvSheet = (postOptions, callback) => {
	    return importSheet(postOptions, callback, headers.textCsv, options.apiUrls.sheets);
	  };

	  var importXlsxSheetIntoFolder = (postOptions, callback) => {
	    return importSheet(postOptions, callback, headers.vndOpenXml, buildFolderUrl(postOptions) + "/");
	  };

	  var importCsvSheetIntoFolder = (postOptions, callback) => {
	    return importSheet(postOptions, callback, headers.textCsv, buildFolderUrl(postOptions) + "/");
	  };

	  var importXlsxSheetIntoWorkspace = (postOptions, callback) => {
	    return importSheet(postOptions, callback, headers.vndOpenXml, buildWorkspaceUrl(postOptions) + "/");
	  };

	  var importCsvSheetIntoWorkspace = (postOptions, callback) => {
	    return importSheet(postOptions, callback, headers.textCsv, buildWorkspaceUrl(postOptions) + "/");
	  };

	  var buildFolderUrl = (requestOptions) => {
	    return options.apiUrls.folders + requestOptions.folderId + '/sheets';
	  };

	  var buildWorkspaceUrl = (requestOptions) => {
	    return options.apiUrls.workspaces + requestOptions.workspaceId + '/sheets'
	  };

	  return {
	    createSheet                  : createSheet,
	    createSheetFromExisting      : createSheetFromExisting,
	    createSheetInFolder          : createSheetInFolder,
	    createSheetInWorkspace       : createSheetInWorkspace,
	    copySheet                    : copySheet,
	    // Not yet released in the API
	    // importCsvAndReplaceSheet     : importCsvAndReplaceSheet,
	    // importXlsxAndReplaceSheet    : importXlsxAndReplaceSheet,
	    importCsvSheet               : importCsvSheet,
	    importXlsxSheet              : importXlsxSheet,
	    importCsvSheetIntoFolder     : importCsvSheetIntoFolder,
	    importXlsxSheetIntoFolder    : importXlsxSheetIntoFolder,
	    importCsvSheetIntoWorkspace  : importCsvSheetIntoWorkspace,
	    importXlsxSheetIntoWorkspace : importXlsxSheetIntoWorkspace,
	  };
	};
	return create;
}

var crosssheetreferences = {};

var hasRequiredCrosssheetreferences;

function requireCrosssheetreferences () {
	if (hasRequiredCrosssheetreferences) return crosssheetreferences;
	hasRequiredCrosssheetreferences = 1;
	var _ = require$$0;

	crosssheetreferences.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var createCrossSheetReference = (postOptions, callback) => {
	    var urlOptions = {url: buildUrlBase(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var getCrossSheetReference = (getOptions, callback) => {
	    var urlOptions = {url: buildUrlBase(getOptions) + getOptions.crossSheetReferenceId};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listCrossSheetReferences = (getOptions, callback) => {
	    var urlOptions = {url: buildUrlBase(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var buildUrlBase = urlOptions =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/crosssheetreferences/';

	  return {
	    createCrossSheetReference : createCrossSheetReference,
	    getCrossSheetReference : getCrossSheetReference,
	    listCrossSheetReferences : listCrossSheetReferences
	  };
	};
	return crosssheetreferences;
}

var discussions = {};

var hasRequiredDiscussions;

function requireDiscussions () {
	if (hasRequiredDiscussions) return discussions;
	hasRequiredDiscussions = 1;
	var _ = require$$0;

	discussions.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var getDiscussions = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listDiscussionAttachments = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions) + '/attachments'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var createDiscussion = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var addDiscussionComment = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/comments'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var deleteDiscussion = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var buildUrl = (urlOptions) =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/discussions/' + (urlOptions.discussionId || '');

	  return {
	    getDiscussions : getDiscussions,
	    getDiscussion : getDiscussions,
	    listDiscussionAttachments : listDiscussionAttachments,
	    createDiscussion : createDiscussion,
	    addDiscussionComment : addDiscussionComment,
	    deleteDiscussion : deleteDiscussion
	  };
	};
	return discussions;
}

var get = {};

var hasRequiredGet;

function requireGet () {
	if (hasRequiredGet) return get;
	hasRequiredGet = 1;
	var _ = require$$0;
	var headers = requireConstants().acceptHeaders;

	get.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.sheets
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var listSheets = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  var getSheetAsCSV = (getOptions, callback) =>
	    listSheets(_.extend({}, getOptions, {accept:headers.textCsv}), callback);

	  var getSheetAsPDF = (getOptions, callback) =>
	    listSheets(_.extend({}, getOptions, {accept:headers.applicationPdf, encoding:null}), callback);

	  var getSheetAsExcel = (getOptions, callback) =>
	    listSheets(_.extend({}, getOptions, {accept:headers.vndMsExcel, encoding:null}), callback);

	  var getSheetVersion = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets + getOptions.sheetId + '/version'};
	    return listSheets(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listOrganizationSheets = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.users + 'sheets'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  return {
	    getSheet        : listSheets, // will retrieve a single sheet when passed 'id' field
	    listSheets      : listSheets,
	    getSheetAsCSV   : getSheetAsCSV,
	    getSheetAsExcel : getSheetAsExcel,
	    getSheetAsPDF   : getSheetAsPDF,
	    getSheetVersion : getSheetVersion,
	    listOrganizationSheets : listOrganizationSheets
	  };
	};
	return get;
}

var sheetsummaries = {};

var hasRequiredSheetsummaries;

function requireSheetsummaries () {
	if (hasRequiredSheetsummaries) return sheetsummaries;
	hasRequiredSheetsummaries = 1;
	var _ = require$$0;

	sheetsummaries.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);

	  var getSummary = (getOptions, callback) => {
	    var urlOptions = {url: buildSummaryUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var getSummaryFields = (getOptions, callback) => {
	    var urlOptions = {url: buildFieldsUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var addSummaryFields = (postOptions, callback) => {
	    var urlOptions = {url: buildFieldsUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var deleteSummaryFields = (deleteOptions, callback) => {
	    var urlOptions = {url: buildFieldsUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var updateSummaryFields = (putOptions, callback) => {
	    var urlOptions = {url: buildFieldsUrl(putOptions)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var addSummaryFieldImage = (postOptions, callback) => {
	    var urlOptions = {url: buildFieldImagesUrl(postOptions)};
	    return requestor.postFile(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var buildSummaryUrl = urlOptions => options.apiUrls.sheets + urlOptions.sheetId + '/summary';

	  var buildFieldsUrl = urlOptions => buildSummaryUrl(urlOptions) + '/fields';

	  var buildFieldImagesUrl = urlOptions =>
	    buildFieldsUrl(urlOptions) + '/' + urlOptions.fieldId + '/images';

	  return {
	    getSummary: getSummary,
	    getSummaryFields: getSummaryFields,
	    addSummaryFields: addSummaryFields,
	    deleteSummaryFields: deleteSummaryFields,
	    updateSummaryFields: updateSummaryFields,
	    addSummaryFieldImage: addSummaryFieldImage
	  };
	};
	return sheetsummaries;
}

var rows = {};

var hasRequiredRows;

function requireRows () {
	if (hasRequiredRows) return rows;
	hasRequiredRows = 1;
	var _ = require$$0;

	rows.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var getRow = (getOptions, callback) => {
	    var urlOptions = {url: buildUrlWithRowId(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var getRowAttachments = (getOptions, callback) => {
	    var urlOptions = {url: buildUrlWithRowId(getOptions) + '/attachments'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var getRowDiscussions = (getOptions, callback) => {
	    var urlOptions = {url: buildUrlWithRowId(getOptions) + '/discussions'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var getCellHistory = (getOptions, callback) => {
	    var urlOptions = {url: buildUrlWithRowId(getOptions) + '/columns/' + getOptions.columnId + '/history'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var copyRowToAnotherSheet = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/copy'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var moveRowToAnotherSheet = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/move'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var addRow = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var addRowUrlAttachment = (postOptions, callback) => {
	    var urlOptions = {url: buildUrlWithRowId(postOptions) + '/attachments'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var addRowFileAttachment = (postOptions, callback) => {
	    var urlOptions = {url: buildUrlWithRowId(postOptions) + '/attachments'};
	    return requestor.postFile(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var createRowDiscussion = (postOptions, callback) => {
	    var urlOptions = {url: buildUrlWithRowId(postOptions) + '/discussions'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var sendRows = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/emails'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var updateRow = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var deleteRow = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions) + '?ids=' + (deleteOptions.rowId || '')};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var deleteRows = (deleteOptions, callback) => {
	    var options = JSON.parse(JSON.stringify(deleteOptions));
	    var params = options.queryParameters;
	    if (_.isArray(params.ids)) {
	      params.ids = params.ids.join(',');
	    }

	    var urlOptions = {url: buildUrl(options)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, options), callback);
	  };

	  var addImageToCell = (postOptions, callback) => {
	    var urlOptions = {url: buildUrlWithRowId(postOptions) + '/columns/' + postOptions.columnId + '/cellimages'};
	    return requestor.postFile(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var buildUrlWithRowId = urlOptions =>
	    buildUrl(urlOptions) + '/' + urlOptions.rowId;

	  var buildUrl = urlOptions =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/rows';

	  return {
	    getRow : getRow,
	    getRowAttachments : getRowAttachments,
	    getRowDiscussions : getRowDiscussions,
	    getCellHistory : getCellHistory,
	    copyRowToAnotherSheet : copyRowToAnotherSheet,
	    moveRowToAnotherSheet : moveRowToAnotherSheet,
	    addRow : addRow,
	    addRows   : addRow,
	    addRowUrlAttachment : addRowUrlAttachment,
	    addRowAttachment: addRowUrlAttachment,
	    addRowFileAttachment : addRowFileAttachment,
	    createRowDiscussion : createRowDiscussion,
	    sendRows : sendRows,
	    deleteRow : deleteRow,
	    deleteRows : deleteRows,
	    updateRow : updateRow,
	    addImageToCell : addImageToCell
	  };
	};
	return rows;
}

var sentupdaterequests = {};

var hasRequiredSentupdaterequests;

function requireSentupdaterequests () {
	if (hasRequiredSentupdaterequests) return sentupdaterequests;
	hasRequiredSentupdaterequests = 1;
	var _ = require$$0;

	sentupdaterequests.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var deleteSentUpdateRequest = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var getSentUpdateRequest = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var getAllSentUpdateRequests = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var buildUrl = urlOptions =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/sentupdaterequests/' + (urlOptions.sentUpdateRequestId || '');

	  return {
	    deleteSentUpdateRequest : deleteSentUpdateRequest,
	    getSentUpdateRequest: getSentUpdateRequest,
	    getAllSentUpdateRequests: getAllSentUpdateRequests
	  };
	};
	return sentupdaterequests;
}

var updaterequests = {};

var hasRequiredUpdaterequests;

function requireUpdaterequests () {
	if (hasRequiredUpdaterequests) return updaterequests;
	hasRequiredUpdaterequests = 1;
	var _ = require$$0;

	updaterequests.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var createUpdateRequest = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var deleteUpdateRequest = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var getUpdateRequest = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var getAllUpdateRequests = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var changeUpdateRequest = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var buildUrl = urlOptions =>
	    options.apiUrls.sheets + urlOptions.sheetId + '/updaterequests/' + (urlOptions.updateRequestId || '');

	  return {
	    createUpdateRequest : createUpdateRequest,
	    deleteUpdateRequest : deleteUpdateRequest,
	    getUpdateRequest : getUpdateRequest,
	    getAllUpdateRequests : getAllUpdateRequests,
	    changeUpdateRequest : changeUpdateRequest
	  };
	};
	return updaterequests;
}

var hasRequiredSheets;

function requireSheets () {
	if (hasRequiredSheets) return sheets;
	hasRequiredSheets = 1;
	var _ = require$$0;
	var attachments = requireAttachments();
	var automationRules = requireAutomationrules();
	var columns = requireColumns();
	var comments = requireComments();
	var createSheets = requireCreate();
	var crossSheetReferences = requireCrosssheetreferences();
	var discussions = requireDiscussions();
	var getSheets = requireGet();
	var summaries = requireSheetsummaries();
	var rows = requireRows();
	var sentUpdateRequests = requireSentupdaterequests();
	var updateRequests = requireUpdaterequests();

	sheets.create = function(options) {
	  var requestor = options.requestor;
	  var shares = requireShare()(options.apiUrls.sheets);

	  var optionsToSend = {
	    urls : options.apiUrls
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var updateSheet = (putOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var deleteSheet = (deleteOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var sendSheetViaEmail = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets + postOptions.sheetId + '/emails'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var moveSheet = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets + postOptions.sheetId + '/move'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var getPublishStatus = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets + getOptions.sheetId + '/publish'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var setPublishStatus = (putOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets + putOptions.sheetId + '/publish'};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var sortRowsInSheet = (postOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sheets + postOptions.sheetId + '/sort'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var sheetObject = {
	    sendSheetViaEmail : sendSheetViaEmail,
	    getPublishStatus : getPublishStatus,
	    setPublishStatus : setPublishStatus,
	    updateSheet : updateSheet,
	    deleteSheet : deleteSheet,
	    moveSheet : moveSheet,
	    sortRowsInSheet : sortRowsInSheet
	  };

	  _.extend(sheetObject, attachments.create(options));
	  _.extend(sheetObject, automationRules.create(options));
	  _.extend(sheetObject, columns.create(options));
	  _.extend(sheetObject, comments.create(options));
	  _.extend(sheetObject, createSheets.create(options));
	  _.extend(sheetObject, crossSheetReferences.create(options));
	  _.extend(sheetObject, discussions.create(options));
	  _.extend(sheetObject, getSheets.create(options));
	  _.extend(sheetObject, summaries.create(options));
	  _.extend(sheetObject, rows.create(options));
	  _.extend(sheetObject, sentUpdateRequests.create(options));
	  _.extend(sheetObject, shares.create(options));
	  _.extend(sheetObject, updateRequests.create(options));

	  return sheetObject;
	};
	return sheets;
}

var sights = {};

var hasRequiredSights;

function requireSights () {
	if (hasRequiredSights) return sights;
	hasRequiredSights = 1;
	var _ = require$$0;

	sights.create = function(options) {
	  var requestor = options.requestor;
	  var shares = requireShare()(options.apiUrls.sights);

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var getSight = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listSights = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.sights};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var deleteSight = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var updateSight = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var copySight = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/copy'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var moveSight = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/move'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var getSightPublishStatus = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions) + '/publish'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var setSightPublishStatus = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions) + '/publish'};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var buildUrl = urlOptions =>
	    options.apiUrls.sights + urlOptions.sightId;

	  var sightObject = {
	    listSights : listSights,
	    getSight   : getSight,
	    deleteSight : deleteSight,
	    updateSight: updateSight,
	    copySight: copySight,
	    moveSight: moveSight,
	    getSightPublishStatus: getSightPublishStatus,
	    setSightPublishStatus: setSightPublishStatus
	  };

	  _.extend(sightObject, shares.create(options));

	  return sightObject;
	};
	return sights;
}

var templates = {};

var hasRequiredTemplates;

function requireTemplates () {
	if (hasRequiredTemplates) return templates;
	hasRequiredTemplates = 1;
	var _ = require$$0;

	templates.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.templates
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var listUserCreatedTemplates = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  var listPublicTemplates = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.templatesPublic};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  return {
	    listUserCreatedTemplates : listUserCreatedTemplates,
	    listPublicTemplates : listPublicTemplates
	  };
	};
	return templates;
}

var tokens = {};

var hasRequiredTokens;

function requireTokens () {
	if (hasRequiredTokens) return tokens;
	hasRequiredTokens = 1;
	var _ = require$$0;

	tokens.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.token,
	  };
	  _.extend(optionsToSend, options.clientOptions);
	  delete optionsToSend.accessToken;

	  var getAccessToken = (postOptions, callback) => {
	    var getTokenQueryStrings = {
	      'grant_type': 'authorization_code'
	    };
	    var combinedQueryParams = {
	      queryParameters: _.extend(getTokenQueryStrings, postOptions.queryParameters)
	    };
	    return requestor.post(_.extend({}, optionsToSend, postOptions, combinedQueryParams), callback);
	  };

	  var refreshAccessToken = (postOptions, callback) => {
	    var getTokenQueryStrings = {
	      'grant_type': 'refresh_token'
	    };
	    var combinedQueryParams = {
	      queryParameters: _.extend(getTokenQueryStrings, postOptions.queryParameters)
	    };
	    return requestor.post(_.extend({}, optionsToSend, postOptions, combinedQueryParams), callback);
	  };

	  var revokeAccessToken = (deleteOptions, callback) => {
	    var accessTokenOptions = {
	      accessToken: options.clientOptions.accessToken
	    };
	    return requestor.delete(_.extend({}, optionsToSend, accessTokenOptions, deleteOptions), callback);
	  };

	  return {
	    getAccessToken : getAccessToken,
	    refreshAccessToken : refreshAccessToken,
	    revokeAccessToken : revokeAccessToken
	  };
	};
	return tokens;
}

var users = {};

var alternateemails = {};

var hasRequiredAlternateemails;

function requireAlternateemails () {
	if (hasRequiredAlternateemails) return alternateemails;
	hasRequiredAlternateemails = 1;
	var _ = require$$0;

	alternateemails.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var addAlternateEmail = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions.userId)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var getAlternateEmail = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions.userId, getOptions.alternateEmailId)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listAlternateEmails = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions.userId)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var makeAlternateEmailPrimary = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions.userId, postOptions.alternateEmailId) + '/makeprimary'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var deleteAlternateEmail = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions.userId, deleteOptions.alternateEmailId)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var buildUrl = (userId, alternateEmailId) =>
	    options.apiUrls.users + userId + '/alternateemails/' + (alternateEmailId || '');

	  return {
	    addAlternateEmail: addAlternateEmail,
	    getAlternateEmail: getAlternateEmail,
	    listAlternateEmails: listAlternateEmails,
	    makeAlternateEmailPrimary: makeAlternateEmailPrimary,
	    deleteAlternateEmail: deleteAlternateEmail
	  };
	};
	return alternateemails;
}

var hasRequiredUsers;

function requireUsers () {
	if (hasRequiredUsers) return users;
	hasRequiredUsers = 1;
	var _ = require$$0;
	var alternateEmails = requireAlternateemails();

	users.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = {
	    url: options.apiUrls.users
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var listAllUsers = (getOptions, callback) =>
	    requestor.get(_.extend({}, optionsToSend, getOptions), callback);

	  var getCurrentUser = (getOptions, callback) => {
	    var urlOptions = {url: options.apiUrls.users + 'me'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var addUser = (postOptions, callback) =>
	    requestor.post(_.extend({}, optionsToSend, postOptions), callback);

	  var addUserAndSendEmail = (postOptions, callback) =>
	    addUser(_.extend({}, postOptions, {queryParameters:{sendEmail:true}}), callback);

	  var updateUser = (putOptions, callback) =>
	    requestor.put(_.extend({}, optionsToSend, putOptions), callback);

	  var removeUser = (deleteOptions, callback) =>
	    requestor.delete(_.extend({}, optionsToSend, deleteOptions), callback);

	  var addProfileImage = (postOptions, callback) => {
	    var urlOptions = {url: buildProfileImageUrl(postOptions)};
	    return requestor.postFile(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var buildProfileImageUrl = urlOptions =>
	    options.apiUrls.users + urlOptions.userId + '/profileimage';

	  var userObject = {
	    getUser                : listAllUsers,
	    listAllUsers           : listAllUsers,
	    getCurrentUser         : getCurrentUser,
	    addUser                : addUser,
	    addUserAndSendEmail    : addUserAndSendEmail,
	    updateUser             : updateUser,
	    removeUser             : removeUser,
	    addProfileImage        : addProfileImage,
	  };

	  _.extend(userObject, alternateEmails.create(options));

	  return userObject;
	};
	return users;
}

var webhooks = {};

var hasRequiredWebhooks;

function requireWebhooks () {
	if (hasRequiredWebhooks) return webhooks;
	hasRequiredWebhooks = 1;
	var _ = require$$0;

	webhooks.create = function(options) {
	  var requestor = options.requestor;

	  var optionsToSend = _.extend({}, options.clientOptions);


	  var createWebhook = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl()};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var deleteWebhook = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions.webhookId)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var updateWebhook = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions.webhookId)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var getWebhook = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions.webhookId)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listWebhooks = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl()};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var resetSharedSecret = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions.webhookId) + '/resetsharedsecret'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var buildUrl = webhookId =>
	    options.apiUrls.webhooks + (webhookId || '');

	  return {
	    createWebhook: createWebhook,
	    getWebhook: getWebhook,
	    listWebhooks: listWebhooks,
	    deleteWebhook: deleteWebhook,
	    updateWebhook: updateWebhook,
	    resetSharedSecret: resetSharedSecret
	  };
	};
	return webhooks;
}

var workspaces = {};

var hasRequiredWorkspaces;

function requireWorkspaces () {
	if (hasRequiredWorkspaces) return workspaces;
	hasRequiredWorkspaces = 1;
	var _ = require$$0;

	workspaces.create = function(options) {
	  var requestor = options.requestor;
	  var shares = requireShare()(options.apiUrls.workspaces);

	  var optionsToSend = {
	    url: options.apiUrls.workspaces
	  };
	  _.extend(optionsToSend, options.clientOptions);


	  var listWorkspaces = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions)};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var listWorkspaceFolders = (getOptions, callback) => {
	    var urlOptions = {url: buildUrl(getOptions) + '/folders'};
	    return requestor.get(_.extend({}, optionsToSend, urlOptions, getOptions), callback);
	  };

	  var createWorkspace = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions)};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var createFolder = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/folders'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var updateWorkspace = (putOptions, callback) => {
	    var urlOptions = {url: buildUrl(putOptions)};
	    return requestor.put(_.extend({}, optionsToSend, urlOptions, putOptions), callback);
	  };

	  var deleteWorkspace = (deleteOptions, callback) => {
	    var urlOptions = {url: buildUrl(deleteOptions)};
	    return requestor.delete(_.extend({}, optionsToSend, urlOptions, deleteOptions), callback);
	  };

	  var copyWorkspace = (postOptions, callback) => {
	    var urlOptions = {url: buildUrl(postOptions) + '/copy'};
	    return requestor.post(_.extend({}, optionsToSend, urlOptions, postOptions), callback);
	  };

	  var buildUrl = urlOptions => {
	    var id ='';
	    if(urlOptions && urlOptions.workspaceId){
	      id = urlOptions.workspaceId;
	    }
	    return options.apiUrls.workspaces + id;
	  };

	  var workspaceObject = {
	    listWorkspaces : listWorkspaces,
	    getWorkspace : listWorkspaces,
	    listWorkspaceFolders : listWorkspaceFolders,
	    createWorkspace : createWorkspace,
	    createFolder : createFolder,
	    deleteWorkspace : deleteWorkspace,
	    updateWorkspace : updateWorkspace,
	    copyWorkspace : copyWorkspace
	  };

	  _.extend(workspaceObject, shares.create(options));

	  return workspaceObject;
	};
	return workspaces;
}

var _ = require$$0;
var winston = require$$1;
var apiUrls = apis;

// Possible TODO: Namespace parameters for different subcomponents
// E.g. clientOptions.requestor.instance OR
//      clientOptions.requestor.settings
//          w/ sub-paths maxRetryDurationSeconds and calcRetryBackoff

function buildRequestor(clientOptions) {
  if(clientOptions.requestor) return clientOptions.requestor;

  var requestorConfig =
    _.pick(clientOptions, 'maxRetryDurationSeconds', 'calcRetryBackoff');

  if(requestorConfig.maxRetryDurationSeconds)
    requestorConfig.maxRetryDurationMillis = requestorConfig.maxRetryDurationSeconds * 1000;

  requestorConfig.logger = buildLogger(clientOptions);

  return requireHttpRequestor()
    .create(requestorConfig);
}
function buildLogger(clientOptions) {
  if(hasMultipleLogOptions(clientOptions)) {
    throw new Error(
      "Smartsheet client options may specify at most one of " +
      "'logger', 'loggerContainer', and 'logLevel'.");
  }

  if(clientOptions.logger) return clientOptions.logger;

  if(clientOptions.logLevel) return buildLoggerFromLevel(clientOptions.logLevel);

  if(clientOptions.loggerContainer) return buildLoggerFromContainer(clientOptions.loggerContainer);

  return null;
}

function hasMultipleLogOptions(clientOptions) {
  return (clientOptions.logger && clientOptions.loggerContainer)
  || (clientOptions.logger && clientOptions.logLevel)
  || (clientOptions.loggerContainer && clientOptions.logLevel);
}

function buildLoggerFromLevel(logLevel) {
  if(winston.levels[logLevel] == null) {
    throw new Error(
      'Smartsheet client received configuration with invalid log level ' +
      `'${logLevel}'. Use one of the standard Winston log levels.`);
  }

  return new (winston.Logger)({
    transports: [
      new winston.transports.Console({
        level: logLevel,
        showLevel: false,
        label: 'Smartsheet'
      })
    ]
  });
}

function buildLoggerFromContainer(container) {
  if(container.has('smartsheet'))
    return container.get('smartsheet');
  else
    throw new Error(
      "Smartsheet client received a logger container, but could not find a logger named " +
      "'smartsheet' inside.");
}

var createClient = smartsheetJavascriptSdk.createClient = function(clientOptions) {
  var requestor = buildRequestor(clientOptions);

  var options = {
    apiUrls: apiUrls,
    requestor: requestor,
    clientOptions: {
      accessToken: clientOptions.accessToken || process.env.SMARTSHEET_ACCESS_TOKEN,
      userAgent: clientOptions.userAgent,
      baseUrl: clientOptions.baseUrl
    }
  };

  return {
    constants  : requireConstants(),
    contacts   : requireContacts().create(options),
    events     : requireEvents().create(options),
    favorites  : requireFavorites().create(options),
    folders    : requireFolders().create(options),
    groups     : requireGroups().create(options),
    home       : requireHome().create(options),
    images     : requireImages().create(options),
    reports    : requireReports().create(options),
    request    : requireRequest().create(options),
    search     : requireSearch().create(options),
    server     : requireServer().create(options),
    sheets     : requireSheets().create(options),
    sights     : requireSights().create(options),
    templates  : requireTemplates().create(options),
    tokens     : requireTokens().create(options),
    users      : requireUsers().create(options),
    webhooks   : requireWebhooks().create(options),
    workspaces : requireWorkspaces().create(options)
  };
};

var smartSheetURIs = smartsheetJavascriptSdk.smartSheetURIs = {
  defaultBaseURI: 'https://api.smartsheet.com/2.0/',
  govBaseURI: 'https://api.smartsheetgov.com/2.0/'
};

export { createClient, smartsheetJavascriptSdk as default, smartSheetURIs };
