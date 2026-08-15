export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="b1">
    <title>Microservices Security in Action</title>
    <author>Siriwardena, Prabath</author>
    <price>49.95</price>
    <genre>Tech</genre>
  </book>
  <book id="b2">
    <title>Design Patterns for Cloud Native Applications</title>
    <author>Indrasiri, Kasun</author>
    <price>49.99</price>
    <genre>Tech</genre>
  </book>
  <book id="b3">
    <title>XSLT 2.0 and XPath 2.0 Programmer's Reference</title>
    <author>Kay, Michael</author>
    <price>49.50</price>
    <genre>Career</genre>
  </book>
</catalog>
`;

export const SAMPLE_XSLT_10 = `<?xml version="1.0" encoding="UTF-8"?>
<!-- XSLT 1.0: sorting, attribute value templates, count() -->
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes"/>

  <xsl:template match="/">
    <books total="{count(/catalog/book)}">
      <xsl:for-each select="/catalog/book">
        <xsl:sort select="price" data-type="number" order="descending"/>
        <book>
          <xsl:value-of select="title"/>
          <xsl:text> — </xsl:text>
          <xsl:value-of select="price"/>
        </book>
      </xsl:for-each>
    </books>
  </xsl:template>
</xsl:stylesheet>
`;

export const SAMPLE_XSLT_10_EXSLT = `<?xml version="1.0" encoding="UTF-8"?>
<!-- XSLT 1.0 + EXSLT extensions (requires the libxslt engine):
     exsl:node-set(), str:tokenize(), math:max() -->
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:exsl="http://exslt.org/common"
                xmlns:str="http://exslt.org/strings"
                xmlns:math="http://exslt.org/math"
                extension-element-prefixes="exsl str math">
  <xsl:output method="xml" indent="yes"/>

  <xsl:variable name="prices-rtf">
    <xsl:for-each select="/catalog/book">
      <p><xsl:value-of select="price"/></p>
    </xsl:for-each>
  </xsl:variable>

  <xsl:template match="/">
    <exslt-demo max-price="{math:max(exsl:node-set($prices-rtf)/p)}">
      <xsl:for-each select="str:tokenize(/catalog/book[1]/author, ', ')">
        <name-part><xsl:value-of select="."/></name-part>
      </xsl:for-each>
    </exslt-demo>
  </xsl:template>
</xsl:stylesheet>
`;

export const SAMPLE_XSLT_20 = `<?xml version="1.0" encoding="UTF-8"?>
<!-- XSLT 2.0: for-each-group, avg(), string-join(), sequence types -->
<xsl:stylesheet version="2.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <xsl:template match="/">
    <report>
      <xsl:for-each-group select="/catalog/book" group-by="genre">
        <genre name="{current-grouping-key()}"
               count="{count(current-group())}"
               avg-price="{format-number(
                   avg(for $b in current-group() return xs:decimal($b/price)),
                   '#,##0.00')}">
          <xsl:value-of select="string-join(current-group()/title, ' | ')"/>
        </genre>
      </xsl:for-each-group>
    </report>
  </xsl:template>
</xsl:stylesheet>
`;

export const SAMPLE_XSLT_20_CSV = `<?xml version="1.0" encoding="UTF-8"?>
<!-- XSLT 2.0: text output method — XML to CSV -->
<xsl:stylesheet version="2.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>

  <xsl:template match="/">
    <xsl:text>title,author,price&#10;</xsl:text>
    <xsl:for-each select="/catalog/book">
      <xsl:value-of select="concat('&quot;', title, '&quot;,',
                                   '&quot;', author, '&quot;,',
                                   price, '&#10;')"/>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
`;
