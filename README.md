# toolbox_FEPS

Small browser tools. Everything runs in the browser, nothing is uploaded.

```
index.html                 home page listing the tools (uses assets/style.css)
assets/style.css           shared look (all tools)
assets/jszip.min.js        JSZip 3.10.1, one shared copy
favicon/favicon.png
nameplates/   nameplates.html + nameplates.js  (+ Nameplates_FEPS.pptx)
registration/ registration.html + registration.js  (+ Registration_template.docx)
sarbacane/    sarbacane.html + sarbacane.js
```

To add a tool: create a folder with `<tool>.html` (link `../assets/style.css`, add `../assets/jszip.min.js` if needed) and `<tool>.js`, then add a block in `index.html`.
