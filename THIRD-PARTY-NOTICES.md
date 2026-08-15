# Third-Party Notices

This extension distributes the following third-party software. The notices
and license terms below are reproduced as required by their respective licenses.

---

## Saxon-JS and xslt3 (Saxonica Ltd)

This extension bundles, in unmodified binary form, the npm packages
"saxon-js" and "xslt3", which are Copyright © Saxonica Ltd
(https://www.saxonica.com/). They are NOT covered by this extension's
Apache-2.0 license; they remain licensed under the Saxonica license
reproduced verbatim below, as required by its redistribution condition (1):

```
      Version 1.0, June 2020
      
      Software: This license applies to the packages "xslt3" and "saxon-js"
      distributed via npm (https://www.npmjs.com) and to the modules SaxonJS2.js
      and SaxonJS2.rt.js available for download from the Saxonica web site
      (https://www.saxonica.com/).
      
      Copyright: The copyright in the Software belongs to Saxonica Ltd, except
      for third-party components listed in the documentation that are distributed
      under license.
      
      Binary form: In this license, "binary form" means the form in which the
      Software is issued (this is technically a set of obfuscated Javascript files).
      
      Deployment and use. The Software may be copied to any computer where the
      primary purpose is the execution of the software on that computer, or on
      connected client computers.
      
      Redistribution.  Redistribution in binary form, without
      modification, is permitted as part of an application that makes use
      of the Software, provided that the following conditions are
      met:
      
      1) Redistributions must reproduce the above copyright notice and the
      following disclaimer in the documentation and/or other materials
      provided with the distribution.
      
      2) Except to the extent explicitly permitted by law, no reverse
      engineering, decompilation, or disassembly of this software is
      permitted.
      
      3) Neither the name of the copyright holder nor the names of its
      contributors may be used to endorse or promote products derived from
      this software without specific prior written permission.
      
      4) Copying the software to a site whose primary purpose is to make
      it available to third parties is not permitted without specific
      prior written permission.
      
      If you institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the software
      itself infringes your patent(s), then your rights granted under this
      license shall terminate as of the date such litigation is filed.
      
      DISCLAIMER. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND
      CONTRIBUTORS "AS IS." ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT
      NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
      FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
      HOLDERS OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
      SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
      TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
      PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
      LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
      NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
      SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## libxslt / xsltproc (not bundled)

The optional "libxslt" engine invokes the `xsltproc` executable already
installed on the user's own system. No part of libxslt, libxml2, or libexslt
is bundled with or distributed by this extension. libxslt is Copyright ©
Daniel Veillard and contributors, and is distributed by its maintainers under
the MIT license (see https://gitlab.gnome.org/GNOME/libxslt).

---

## Other bundled npm dependencies

The bundled `xslt3` package pulls in a number of open-source npm dependencies
(axios, follow-redirects, form-data, mime-types, debug, and related helper
packages), each distributed under a permissive MIT-style license. Their
original LICENSE files are included unmodified in the `node_modules` folder
shipped inside this extension.
