(function() {
  if (!('localStorage' in window && window['localStorage'] !== null)) alert("No support for localStorage.");

  // Dom helpers
  $ = function(s) { return document.getElementById(s); }
  function showModal(txt) {
    var m = $('modal');
    var msg = $('modal-msg');
    msg.innerHTML = txt || 'Loading';
    document.body.style.height = window.innerHeight + 'px';
    document.body.style.overflow = 'hidden';
    m.style.display = '';
  }
  
  function hideModal() { 
    document.body.style.height = '';
    document.body.style.overflow = '';
    $('modal').style.display = 'none'; 
  }

  // Extend the String object for simple templating
  String.prototype.format = function(){
      var args = arguments;
      obj = (args.length == 1 && (typeof args[0] == 'object')) ? args[0] : args;
      return this.replace(/\{(\w+)\}/g, function(m, i){
          return obj[i];
      });
  }

  // helper for XHR
  function xhr(url, options) {
    var xhr = new XMLHttpRequest(),
        async = (options && options.async ? options.async : true);

    xhr.open("GET", url, async, (options && options.username ? options.username : null ), (options && options.password ? options.password : null ));

    if (options && options.headers) {
      // Lifted from xui source; github.com/xui/xui/blob/master/src/js/xhr.js
      for (key in options.headers) {
          if (options.headers.hasOwnProperty(key)) {
            xhr.setRequestHeader(key, options.headers[key]);
          }
      }
    }

    xhr.setRequestHeader("Accept", "application/json");

    xhr.onreadystatechange = function(){
      if ( xhr.readyState == 4 ) {
        if ( xhr.status == 200 || xhr.status == 0) {
          options.callback.call(xhr);
        } else {
          alert('XHR error, status: ' + xhr.status);
        }
      }
    };
    xhr.send((options && options.data? options.data : null));
  }

  // plugin error handler
  function pluginError(msg) {
    alert('Hydration plugin error!' + msg);
    hideModal();
  }

  // saves app information to localstorage and loads app into current webview
  function saveAppInfoAndLoad(id, app) {
    var apps = window.localStorage.getItem('apps');
    if (apps == null) {
      apps = {};
    } else {
      apps = JSON.parse(apps);
    }
    apps['app' + id] = app;
    window.localStorage.setItem('apps', JSON.stringify(apps));
    console.log('loading ' + app.location);
    window.location = app.location;
  }

  // loads an app
  loadApp = function(id, username, password) {
    var url = 'https://build.phonegap.com/api/v0/apps/' + id + '/hydrate';
    var apps = window.localStorage.getItem('apps');

    // Check the last updated timestamp on build.
    xhr(url, {
      callback:function() {
        console.log('xhr callback');
        console.log(this);
        console.log(this.responseText);
        eval('var json = ' + this.responseText + ';');
        if (json.error) {
          alert("build.phonegap.com error: " + json.error);
          hideModal();
        } else {
          // We get an S3 url, updated_at time stamp and app title.
          var sthree = json['s3_url'].replace(/&amp;/gi, '&'),
              updatedAt = json['updated_at'],
              title = json['title'],
              key = json['key'];

          // Weird JSON.parse error in Android browser: can't parse null, it'll throw an exception.
          if (apps != null) apps = JSON.parse(apps);

          // Check if we've already stored this app.
          if (apps && typeof apps['app' + id] != 'undefined') {
            var app = apps['app' + id];

            // Update its data.
            app.title = title;
            app.username = username;
            app.password = password;

            // Check if the app was updated on build.phonegap.com
            if (app.updatedAt != updatedAt) {
              console.log('new version of app, update this shit!');
              app.updatedAt = updatedAt;
              showModal('Downloading application update...');
              window.plugins.remoteApp.fetch(function(loc) {
                console.log('new version app fetch plugin success!');
                app.location = loc;
                saveAppInfoAndLoad(id, app);
              }, pluginError, key, id, sthree, null, null);
            } else {
              console.log('same version of app, dont update, just load it');
              showModal('Loading application...');
              window.location = app.location;
            }
          } else {
            // Couldn't find the app in local storage, fetch it yo.
            showModal('Downloading application...');
            console.log('fresh app, fetching it for first time');
            window.plugins.remoteApp.fetch(function(loc) {
              var app = {
                title:title,
                location:loc,
                username:username,
                password:password,
                updatedAt:updatedAt,
                key:key
              };
              console.log('fresh app fetch plugin success!');
              saveAppInfoAndLoad(id, app);
            }, pluginError, key, id, sthree, null, null);
          }
        }
      },
      async:true,
      username:username,
      password:password
    });
  }

  // Hydrate action
  hydra = function() {
    var id = $('app_id').value;
    var username = $('username').value;
    var password = $('password').value;

    showModal('Talking to build.phonegap.com...');
    loadApp(id, username, password);
  }
  document.addEventListener('deviceready', function() {
    console.log('deviceready');
    document.getElementById('action').style.display = 'block';

    // Load existing apps.
    if (window.localStorage && window.localStorage.getItem('apps')) {
      console.log('loading existing apps into dom');
      var apps = JSON.parse(window.localStorage.getItem('apps')),
          template = '<li><a href="#" onclick="loadApp(\'{appId}\', \'{username}\', \'{password}\');"><img src="" class="icon"><h1>{name}</h1><small>Last updated at {updatedAt}</small></a></li>',
          html = [];
      for (var app_id in apps) {
        if (apps.hasOwnProperty(app_id)) {
          var app = apps[app_id];
          if (app.updatedAt && app.location) {
            html.push(template.format({
              appId:app_id.substr(3),
              name:app.title,
              updatedAt:prettyDate(app.updatedAt),
              username:app.username,
              password:app.password
            }));
          }
        }
      }
      if (html.length > 0) {
        var list = $('app_list');
        list.innerHTML = html.join('');
        list.style.display = '';
      }
    }
  }, false);
})();
