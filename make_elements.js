const fs = require('fs');
const path = require('path');

const elements = [
  'Button', 'IconButton', 'Badge', 'ProgressBar', 'TextInput', 
  'Textarea', 'NumberInput', 'Checkbox', 'Select', 
  'InlineNumberInput', 'Modal', 'ConfirmDialog', 'Tabs', 
  'ColorPicker', 'IconPicker', 'TagInput'
];

elements.forEach(el => {
  const dir = path.join(__dirname, 'components', 'elements', el);
  fs.mkdirSync(dir, { recursive: true });
  
  fs.writeFileSync(path.join(dir, `${el}.tsx`), `import React from 'react';\nimport clsx from 'clsx';\nimport styles from './${el}.module.scss';\n\nexport const ${el} = (props: any) => {\n  return <div className={styles.root} {...props} />;\n};\n`);
  
  fs.writeFileSync(path.join(dir, `${el}.module.scss`), `@use 'variables' as *;\n@use 'mixins' as *;\n\n.root {\n  /* TODO: implement */\n}\n`);
});
