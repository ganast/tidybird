/*
	Tidyird extension for Mozilla Thunderbird - Organize email into folders
	quickly and easily.
	
    Copyright (C) 2018 George Anastassakis (ganast@ganast.com)
	
	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var tidybirdPane = `
    <splitter
	  id="tidybirdSplitter"
	  collapse="after"
	  orient="horizontal"
	  persist="state hidden"
    x-tidybird="added"
	/>
    <vbox
	  id="tidybirdPane"
	  height="300"
	  width="200"
	  persist="width height hidden"
    x-tidybird="added"
	>
	  <!--label>Move selected message(s) to:</label-->
	  <vbox id="tidybirdButtonList" x-tidybird="added">
		<!-- folder move buttons will be dynamically added here -->
	  </vbox>
    </vbox> 
`
