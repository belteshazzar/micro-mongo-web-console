
import {Chalk} from 'chalk';
import * as parse5 from "parse5";
import * as parse5_htmlparser2_tree_adapter_1 from "parse5-htmlparser2-tree-adapter";

const customChalk = new Chalk({level: 1});

function colorizeNode(node, theme, context) {
    if (theme === void 0) { theme = {}; }
    switch (node.type) {
        case 'text': {
            var text = node.data;
            if (context === undefined) {
                return text
            }
            return text;
        }
        case 'tag': {
            var hljsClass = /hljs-(\w+)/.exec(node.attribs.class);
            if (hljsClass) {
                var token_1 = hljsClass[1];
                var nodeData = node.childNodes
                    .map(function (node) { return colorizeNode(node, theme, token_1); })
                    .join('');
                const color = theme[token_1]
                if (color=='plain') return nodeData
                return customChalk[color](nodeData);
            }
            // Return the data itself when the class name isn't prefixed with a highlight.js token prefix.
            // This is common in instances of sublanguages (JSX, Markdown Code Blocks, etc.)
            return node.childNodes.map(function (node) { return colorizeNode(node, theme); }).join('');
        }
    }
    throw new Error('Invalid node type ' + node.type);
}

export default function colorize(code, theme) {
    if (theme === void 0) { theme = {}; }
    var fragment = parse5.parseFragment(code, {
        treeAdapter: parse5_htmlparser2_tree_adapter_1.adapter,
    });
    return fragment.childNodes.map(function (node) { return colorizeNode(node, theme); }).join('');
}
