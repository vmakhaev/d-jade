var jade  = require('jade');
var coffee = require('./coffee');
//process.env.DEBUG = 'derby-jade';
var debug = require('debug')('derby-jade');
var options;
var defaultIndent = 2;

module.exports = function (app, opts) {
  options = opts || {};
  app.viewExtensions.push('.jade');
  app.compilers['.jade'] = compiler;
};

function addindent(source, count) {
  if (count === undefined) count = defaultIndent;
  var indentation = '';
  for (var i = 0; i < count; i++) {
    indentation += ' ';
  }
  return indentation + source;
}

function preprocess(source) {
  return source
    // Replace if, else, each, etc statements to __derby-statement(type="if", value="expression")
    // we cheat Jade, because it has it`s own statements
    .replace(/^([ \t]+)(if|else(?:[ \t]+if)?|unless|each|with|bound|unbound|on)((?:[ \t]|\().+)?$/gm,
      function (statement, indentation, type, expression) {
        if (options.coffee) {
          expression = ' ' + coffee(expression);
        }
        return indentation + '__derby-statement(type=\"' + type + '\"' + 
          (expression ? ' value=\"' + escape(expression) + '\"' : '') + ')';
    })
    // This is needed for coffee
    // find all statements in {{..}}
    .replace(/{{([^\/].*?)}}/g, function(statement, expression) {
      var block = '';
      if (blockCaptures = /^((?:unescaped|if|else if|unless|each|with|bound|unbound|on)\*?) *([^\n]*)/.exec(expression)) {
        block = blockCaptures[1] + ' ';
        expression = blockCaptures[2];
      } else if (expression === 'else') {
        block = expression;
        expression = '';
      }
      if (options.coffee) expression = coffee(expression);
      return '{{' + block + expression + '}}';
    })
    // Make Derby attribues unescaped
    .replace(/on-(.*)=['"](.*)['"]/gm, function(statement, type, expression) {
      if (options.coffee) expression = coffee(expression);
      return 'on-' + type + '!=\"' + expression + '\"';
    });
}

function postprocess(html) {
  return html
    // Clean redundant Derby statements
    .replace(/[ \t]*<\/__derby-statement>\n?(?=\s+<__derby-statement type="else([ \t]+if)?")/g, '')
    // Replace Derby statements back
    .replace(/<__derby-statement type="([^"]+)"(?: value="([^"]+)")?>/gm, function (statement, type, value) {
      if (value === '%20') value = '';
      return '{{' + type + (value ? unescape(value) : '') + '}}';
    })
    // Closing Derby statements
    .replace(/<\/__derby-statement>/g, '{{/}}');
}

function compiler(file, fileName) {
  var out = [];
  var lines = file.split('\n');
  var lastComment = Infinity;
  var lastScript = Infinity;
  var script = [];
  var scripts = [];
  var block = [];
  var debugString;

  function renderBlock() {
    if (block.length) {
      debugString += ', block end';
      var source = preprocess(block.join('\n'));
      block = [];
      var jadeOptions = {
        filename: fileName,
        pretty: true
      }
      jade.render(source, jadeOptions, function (error, html) {
        if (error) throw error;
        html = html
          // Remove underscores
          .replace(/<_derby_/g, '<')
          .replace(/<\/_derby_/g, '<\/')
          // Add colons
          .replace(/^\s*(<([\w-]+))((?:\b[^>]+)?>)\n?([\s\S]*?)\n?<\/\2>$/, function (template, left, name, right, content) {
            return left + ':' + right + (content ? '\n' + content : '');
          })
          // Add scripts
          .replace(/<script(\d*)><\/script\1>/g, function(statement, index) {
            return scripts[index];
          });
        out.push(postprocess(html));
      });
    }
  }

  function closeScript() {
    if (script.length) {
      var source = script.join('\n');
      if (options.coffee) source = coffee(source);
      script = [];
      var scriptSource = '<script>';
      source.split('\n').forEach(function (scriptLine) {
        scriptLine = scriptLine.replace(/^\s*/g, '');
        scriptSource += '\n' + addindent(scriptLine, lastScript + defaultIndent);
      });
      scriptSource += '\n' + addindent('</script>', lastScript);
      scripts.push(scriptSource);
      block.push(addindent('script' + (scripts.length - 1), lastScript));
    }
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    var res = /^(\s*)(.*?)$/g.exec(line);
    var spaces = res[1];
    var statement = res[2];
    var indent = spaces.length;
    debugString = addindent(statement, indent) + ' | ' + indent;

    // Comment
    if (lastComment !== Infinity) {
      if (indent > lastComment) {
        debug(debugString + ', comment');
        continue;
      } else {
        debugString += ', comment end';
        lastComment = Infinity;
      }
    }
    if (statement.indexOf('//') === 0) {
      lastComment = indent;
      debug(debugString + ', comment start');
      continue;
    }
    // Script
    if (lastScript !== Infinity) {
      if (indent > lastScript) {
        script.push(addindent(statement, indent));
        debug(debugString + ', script');
        continue;
      } else {
        debugString += ', script end';
        closeScript();
        lastScript = Infinity;
      }
    }
    if (statement.indexOf('script.') === 0) {
      // Script block
      lastScript = indent;
      debug(debugString + ', script.start');
      continue;
    }
    if (statement.indexOf('script ') === 0) {
      // Script line
      if (options.coffee) statement = 'script ' + coffee(statement.slice(7));
      block.push(addindent(statement, indent));
      debug(debugString + ', script line');
      continue;
    }
    // Empty line
    if (!statement.length) {
      block.push('');
      debug(debugString + ', empty');
      continue;
    }

    if (indent === 0) {
      // Derby tag
      // It means that we are going to start another block,
      // so we should render last one first
      renderBlock();
      // Remove colons after Derby tags
      // it makes colons optional
      statement = statement.replace(/^([^(]*):/, function(statement, tag) {
        return tag;
      });
      // We add underscore to avoid problems when Derby tag name
      // is same as non closing tags
      statement = '_derby_' + statement;
      debugString += ', block start';
      block.push(statement);
    } else {
      debugString += ', block';
      block.push(line);
    }
    debug(debugString);
  }
  // Close script if exist and render block
  closeScript();
  renderBlock();

  return out.join('\n');
}