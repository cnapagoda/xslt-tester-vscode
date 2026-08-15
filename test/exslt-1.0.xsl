<?xml version="1.0"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:exsl="http://exslt.org/common"
                xmlns:str="http://exslt.org/strings"
                xmlns:math="http://exslt.org/math"
                extension-element-prefixes="exsl str math">
  <xsl:output method="xml" indent="yes"/>
  <xsl:variable name="prices-rtf">
    <xsl:for-each select="/catalog/book"><p><xsl:value-of select="price"/></p></xsl:for-each>
  </xsl:variable>
  <xsl:template match="/">
    <exslt-demo max-price="{math:max(exsl:node-set($prices-rtf)/p)}">
      <xsl:for-each select="str:tokenize(/catalog/book[1]/author, ', ')">
        <name-part><xsl:value-of select="."/></name-part>
      </xsl:for-each>
    </exslt-demo>
  </xsl:template>
</xsl:stylesheet>
