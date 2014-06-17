var jade  = require("jade");
var coffee = require("./coffee");
var options;

function trimindent(source, indentation) {
	indentation = indentation || /^\s+/.exec(source);
	return source.replace(new RegExp("^"+indentation, "gm"), "");
}
function indent(source, indentation) {
	indentation = indentation || "	";
	return source.replace(/^(.*)/gm, indentation+"$1");
}
function preprocess(source) {
	return source
		.replace(/^([ \t]+)(if|else(?:[ \t]+if)?|unless|each|with)((?:[ \t]|\().+)?$/gm, function (statement, indentation, type, value) {
			if (options.coffee) {
				value = " " + coffee(value);
			}
			return indentation+"__derby-statement(type=\""+type+"\""+(value ? " value=\""+escape(value)+"\"" : "")+")";
		})
		.replace(/{{(.*)}}/gm, function(statement, expression) {
			var block = "";
			if (blockCaptures = /^((?:unescaped)\*?) *([^\n]*)/.exec(expression)) {
        block = blockCaptures[1] + " ";
        expression = blockCaptures[2];
      }
			if (options.coffee) expression = coffee(expression);
			return "{{" + block + expression + "}}";
		})
		.replace(/on-(.*)=['"](.*)['"]/gm, function(statement, type, expression) {
			if (options.coffee) expression = coffee(expression);
			return "on-" + type + "!=\"" + expression + "\"";
		});
}
function postprocess(html) {
	return html
		.replace(/\t/g, "")
		.replace(/[ \t]*<\/__derby-statement>\n?(?=\s+<__derby-statement type="else([ \t]+if)?")/g, "")
		.replace(/<__derby-statement type="([^"]+)"(?: value="([^"]+)")?>/g, function (statement, type, value) {
			return "{{"+type+(value ? unescape(value) : "")+"}}";
		})
		.replace(/<\/__derby-statement>/g, "{{/}}")
		.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, function(statement, script) {
			if (options.coffee) script = coffee(script);
			return "<script>\n" + script + "\n</script>";
		});
}

function jadeCompiler(file, filename, options) {
	var out = [];
	preprocess(file).match(/^\w+.*$(?:\n^([ \t]+).*$(?:\n^\1.*$)*)?/gm).forEach(function (template) {
		jade.render(template, {"pretty": true}, function (error, html) {
			if (error) {
				console.error(error);
			}
			out.push(html.replace(/^\s*(<(\w+))((?:\b[^>]+)?>)\n?([\s\S]*?)\n?<\/\2>$/, function (template, left, name, right, content) {
				return left+":"+right+(content ? "\n"+indent(content) : "")+"\n";
			}));
		});
	});
	return postprocess(out.join("\n"));
}

module.exports = function (app, opts) {
	options = opts || {};
	app.viewExtensions.push(".jade");
	app.compilers[".jade"] = jadeCompiler;
};
