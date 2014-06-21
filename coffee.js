var coffeeScript = require("coffee-script");

module.exports = function (js) {
  if (!js) return '';
  var original = js;
  // Exclude Derby block alias
  var alias;
  var aliasIndex = js.indexOf(" as ");
  if (aliasIndex >= 0) {
    alias = js.substr(aliasIndex);
    js = js.substr(0, aliasIndex);
  }
  // Replace # to not widely used symbol for alias variable names
  // js variables can not start with #
  js = js.replace(/@(?!\.)/g, "☺");
  js = js.replace(/#/g, "〇");
  try {
    js = coffeeScript.compile(js, {bare: true});
  } catch (err) {
    console.log("Coffeescript compilation error:");
    console.log(err);
    return original;
  }
  // Replace back
  js = js.replace(/☺/g, "@");
  js = js.replace(/〇/g, "#");
  // Trim
  js = js.replace(/^\s+|\s+$/g, "");
  // Remove semicolon
  var lastSymbol = js[js.length - 1];
  if (lastSymbol === ";") {
    js = js.slice(0, -1);
  }
  // Include alias
  if (alias) js += alias;
  return js;
}